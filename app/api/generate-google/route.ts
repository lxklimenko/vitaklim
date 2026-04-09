import { NextResponse } from "next/server";
import { createClient } from '@/app/lib/supabase-server';
import sharp from "sharp";
import crypto from 'crypto';
import { STORAGE_BUCKET } from '@/app/constants/storage';
import OpenAI from "openai";

// Константы
const GENERATION_COST = parseInt(process.env.GENERATION_COST || "1", 10);
const FETCH_TIMEOUT = 60000; // 60 секунд для генерации изображения
const MAX_IMAGE_SIZE_MB = 10;

interface GenerationRequest {
  prompt: string;
  aspectRatio?: string;
  modelId: string;
  imageFile?: File;
}

interface RpcResult {
  success: boolean;
  error?: string;
}

// Утилита для генерации уникального имени файла
function generateFileName(userId: string, prefix = ''): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  return `${userId}/${prefix}${timestamp}-${random}.jpg`;
}

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const supabase = await createClient();
  // Для гарантированной очистки при ошибках
  let uploadedFiles: string[] = [];
  let processingRecord: any = null;
  let user: any = null;
  let usedCost = GENERATION_COST;

  try {
    // 1. Аутентификация
    const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
    if (!authUser || userError) {
      return NextResponse.json(
        { error: "Вы не авторизованы" },
        { status: 401 }
      );
    }
    user = authUser;

    // Засекаем время начала генерации
    const startTime = Date.now();

    // 2. Парсинг multipart/form-data
    const formData = await req.formData();
    const prompt = formData.get('prompt')?.toString();
    let aspectRatio = formData.get('aspectRatio')?.toString();
    // Очищаем: убираем пробелы и заменяем " / " на ":"
    if (aspectRatio) {
      aspectRatio = aspectRatio.replace(/\s+/g, '').replace('/', ':');
    }
    const modelId = formData.get('modelId')?.toString();
    const imageFile = formData.get('image') as File | null;
    const isPublic = formData.get('isPublic') === 'true';

    if (!prompt?.trim()) {
      return NextResponse.json(
        { error: "Не указан prompt" },
        { status: 400 }
      );
    }

    if (!modelId) {
      return NextResponse.json(
        { error: "Не указана модель" },
        { status: 400 }
      );
    }

    // Модели, поддерживающие генерацию изображений
    const IMAGE_MODELS = [
      "gemini-3.1-flash-image-preview",
      "gemini-2.0-flash-exp-image-generation",
      "gemini-3-pro-image-preview",
      "gemini-2.5-flash-image",
      "imagen-4-ultra",
      "dall-e-3"
    ];

    if (!IMAGE_MODELS.includes(modelId)) {
      return NextResponse.json(
        { error: "Модель не поддерживает генерацию изображений" },
        { status: 400 }
      );
    }

    // 🔒 Anti-spam защита
    const { data: lastGeneration } = await supabase
      .from('generations')
      .select('created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastGeneration?.created_at) {
      const lastTime = new Date(lastGeneration.created_at).getTime();
      const now = Date.now();
      const diffInSeconds = (now - lastTime) / 1000;

      if (diffInSeconds < 3) {
        return NextResponse.json(
          { error: "Слишком частые запросы. Подождите 3 секунды." },
          { status: 429 }
        );
      }
    }

    // 🧹 Очистка зависших pending через RPC
    await supabase.rpc('cleanup_stale_generations');

    // 🟡 Создаём запись со статусом pending
    const { data: newProcessingRecord, error: processingError } = await supabase
      .from('generations')
      .insert({
        user_id: user.id,
        prompt,
        status: 'pending',
        model_id: modelId
      })
      .select()
      .single();

    if (processingError || !newProcessingRecord) {
      const isUniqueError =
        processingError &&
        (processingError.code === '23505' ||
          /duplicate key|unique constraint/i.test(processingError.message || ''));

      if (isUniqueError) {
        return NextResponse.json(
          { error: "У вас уже запущена генерация. Дождитесь завершения." },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: "Не удалось создать запись генерации" },
        { status: 500 }
      );
    }

    processingRecord = newProcessingRecord;

    // 💰 Определяем стоимость в зависимости от модели
    let cost = GENERATION_COST;
    if (modelId === 'gemini-3-pro-image-preview') cost = 10;
    else if (modelId === 'gemini-3-pro-image-preview-4k' || modelId.includes('-4k')) cost = 20;
    else if (modelId === 'gemini-3.1-flash-image-preview') cost = 5;
    else if (modelId === 'imagen-4-ultra' || modelId === 'dall-e-3') cost = 5;
    usedCost = cost;

    // 💰 Списываем баланс ДО генерации
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('create_generation', {
        p_generation_id: processingRecord.id,
        p_user_id: user.id,
        p_cost: cost
      });

    if (rpcError) {
      throw new Error('Не удалось выполнить операцию списания средств');
    }

    const result = rpcResult as RpcResult;
    if (!result.success) {
      throw new Error(result.error || "Не удалось списать средства");
    }

    // 🧠 Если выбрана модель Imagen Ultra, обрабатываем отдельно
    if (modelId === 'imagen-4-ultra') {
      return await generateImagenUltra({
        prompt,
        aspectRatio,
        imageFile,
        user,
        processingRecord,
        supabase,
        uploadedFiles,
        startTime,
        isPublic
      });
    }

    // 👇 Направляем запрос в OpenAI для DALL-E 3 (с поддержкой референса)
    if (modelId === 'dall-e-3') {
      return await generateOpenAI({
        prompt,
        aspectRatio,
        imageFile,
        user,
        processingRecord,
        supabase,
        uploadedFiles,
        startTime,
        isPublic
      });
    }

    // 4. Проверка API-ключа (для Gemini)
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.error('Google API key not configured');
      throw new Error("Сервис временно недоступен (ошибка конфигурации)");
    }

    // 5. Формируем тело запроса для Gemini API
    let processedImageBuffer: Buffer | null = null;

    // Усиленный промпт для повышения качества (без добавления aspect ratio в текст)
    const finalPrompt = `
${prompt}

ultra detailed
professional photography
sharp focus
natural skin texture
high dynamic range
cinematic lighting
photorealistic
high resolution
`;

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: finalPrompt }
    ];

    if (imageFile) {
      try {
        if (imageFile.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
          throw new Error(`Размер изображения превышает ${MAX_IMAGE_SIZE_MB} МБ`);
        }

        const allowedMimeTypes = [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/heic',
          'image/heif'
        ];

        if (!allowedMimeTypes.includes(imageFile.type)) {
          throw new Error('Неподдерживаемый формат изображения');
        }

        const arrayBuffer = await imageFile.arrayBuffer();
        const inputBuffer = Buffer.from(arrayBuffer);

        // Референс-изображение обрабатываем (ресайз и конвертация в JPEG)
        // Это необходимо для отправки в API, но не влияет на итоговый результат генерации.
        const jpegBuffer = await sharp(inputBuffer)
          .resize({ width: 2048, withoutEnlargement: true })
          .jpeg({
            quality: 100,
            chromaSubsampling: '4:4:4'
          })
          .toBuffer();

        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: jpegBuffer.toString("base64")
          }
        });

        processedImageBuffer = jpegBuffer;
      } catch (imgError) {
        console.error('Image processing error:', imgError);
        throw new Error(imgError instanceof Error ? imgError.message : "Ошибка обработки изображения");
      }
    }

    // Определяем "премиальность" модели для сайта
    const isHighResModel = modelId === "gemini-3-pro-image-preview" || modelId === "imagen-4-ultra";

    const requestBody = {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ["image"],
        ...(aspectRatio && aspectRatio !== 'auto' && { 
          imageConfig: { 
            aspectRatio: aspectRatio,
          } 
        }),
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
      ]
    };

    // 6. URL для Gemini API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

    // 7. Вызов API с таймаутом и ретраем
    let response: Response;

    const makeRequest = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        return res;
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    };

    try {
      response = await makeRequest();

      if (response.status === 429 || response.status === 503) {
        console.warn("Gemini API temporary error, retrying...");
        await new Promise(resolve => setTimeout(resolve, 1000));
        response = await makeRequest();
      }
    } catch (fetchError) {
      console.error('Network error calling Gemini API:', fetchError);
      throw new Error("Ошибка сети при обращении к API генерации");
    }

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", data);
      const errorMessage = data.error?.message || "Ошибка генерации изображения";
      throw new Error(errorMessage);
    }

    // 8. Проверка наличия кандидатов
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("Модель не вернула результат");
    }

    const candidate = data.candidates[0];
    const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);

    if (!imagePart) {
      const textPart = candidate?.content?.parts?.find((part: any) => part.text);
      const errorText = textPart?.text || "Модель не вернула изображение. Возможно, промпт был заблокирован.";
      throw new Error(errorText);
    }

    const base64Image = imagePart.inlineData.data;

    // 9. СМАРТ-ОБРАБОТКА (Smart Upscale для Pro-качества)
    const rawBuffer = Buffer.from(base64Image, 'base64');
    let sharpInstance = sharp(rawBuffer);
    const metadata = await sharpInstance.metadata();

    // Проверяем: если модель Pro/Ultra, а разрешение низкое — увеличиваем до 4MP
    if (isHighResModel && metadata.width && metadata.width < 1500) {
      console.log(`[UPSCALE SITE] Нативное: ${metadata.width}. Формат: ${aspectRatio}`);
      
      // Парсим пропорции (из "21:9" -> w:21, h:9)
      const ratioParts = (aspectRatio || "1:1").split(':').map(Number);
      const wPart = ratioParts[0] || 1;
      const hPart = ratioParts[1] || 1;
      const ratio = wPart / hPart;

      // Целевая площадь — 4.2 миллиона пикселей
      const targetArea = 4194304; 
      let targetWidth = Math.round(Math.sqrt(targetArea * ratio));
      
      // Лимит по ширине для стабильности браузера
      if (targetWidth > 2560) targetWidth = 2560;

      sharpInstance = sharpInstance
        .resize({ 
          width: targetWidth, 
          kernel: sharp.kernel.lanczos3,
          withoutEnlargement: false 
        })
        .sharpen(1.0, 0.5, 0.2); // Тот самый фикс для билда
    }

    const optimizedBuffer = await sharpInstance
      .jpeg({
        quality: isHighResModel ? 100 : 85,
        chromaSubsampling: isHighResModel ? '4:4:4' : '4:2:0',
        force: true
      })
      .toBuffer();

    const fileName = generateFileName(user.id);

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, optimizedBuffer, { contentType: 'image/jpeg' });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error('Не удалось сохранить сгенерированное изображение');
    }
    uploadedFiles.push(fileName);

    // Получаем публичную ссылку на загруженное изображение
    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);

    // 10. Если было reference-изображение, сохраняем его (опционально)
    let referencePublicUrl: string | null = null;
    let referenceFileName: string | null = null;

    if (processedImageBuffer) {
      try {
        const refFileName = generateFileName(user.id, 'reference-');
        const { error: refUploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(refFileName, processedImageBuffer, { contentType: 'image/jpeg' });

        if (!refUploadError) {
          const { data: { publicUrl: refUrl } } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(refFileName);
          referencePublicUrl = refUrl;
          referenceFileName = refFileName;
          uploadedFiles.push(refFileName);
        } else {
          console.error("Ошибка сохранения reference-изображения:", refUploadError);
        }
      } catch (refError) {
        console.error("Не удалось сохранить reference-изображение:", refError);
      }
    }

    const generationTime = Date.now() - startTime;

    // ✅ Обновляем запись после успешной генерации
    if (processingRecord) {
      await supabase
        .from('generations')
        .update({
          status: 'completed',
          image_url: publicUrl,
          storage_path: fileName,
          reference_image_url: referencePublicUrl,
          reference_storage_path: referenceFileName,
          generation_time_ms: generationTime,
          is_public: isPublic,
          cost: cost,
          model_id: modelId
        })
        .eq('id', processingRecord.id);
    }

    // 12. Возвращаем generationId клиенту
    return NextResponse.json({
      generationId: processingRecord.id
    });

  } catch (error: unknown) {
    console.error("Server Error:", error);

    // 🧹 Очистка загруженных файлов
    if (uploadedFiles.length > 0) {
      try {
        await supabase.storage
          .from(STORAGE_BUCKET)
          .remove(uploadedFiles);
      } catch (cleanupError) {
        console.error("Cleanup error:", cleanupError);
      }
    }
    // ❌ Обновляем статус записи на failed
    if (processingRecord?.id) {
      try {
        await supabase
          .from('generations')
          .update({ status: 'failed' })
          .eq('id', processingRecord.id);
      } catch (statusError) {
        console.error("Failed to update generation status:", statusError);
      }
    }

    // 💸 Возврат средств при ошибке
    if (user?.id) {
      try {
        await supabase.rpc('refund_generation', {
          p_generation_id: processingRecord?.id,
          p_user_id: user.id,
          p_amount: usedCost
        });
      } catch (refundError) {
        console.error("Refund error:", refundError);
      }
    }

    // 🧾 Логируем ошибку в БД
    try {
      await supabase.from('app_errors').insert({
        user_id: user?.id ?? null,
        generation_id: processingRecord?.id ?? null,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        error_stack: error instanceof Error ? error.stack ?? null : null,
        context: 'generate-google'
      });
    } catch (logError) {
      console.error('Error logging failed:', logError);
    }

    const message =
      error instanceof Error ? error.message : "Внутренняя ошибка сервера";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Генерация изображения через Imagen 4 Ultra с поддержкой соотношения сторон и референс-изображения.
 * Полученное изображение сохраняется без изменений.
 */
async function generateImagenUltra({
  prompt,
  aspectRatio,
  imageFile,
  user,
  processingRecord,
  supabase,
  uploadedFiles,
  startTime,
  isPublic
}: any) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("Сервис временно недоступен (ошибка конфигурации)");
  }

  // Обработка референса (при необходимости конвертируем в JPEG с ресайзом)
  let referenceBase64: string | undefined;

  if (imageFile) {
    const arrayBuffer = await imageFile.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    const jpegBuffer = await sharp(inputBuffer)
      .resize({ width: 2048, withoutEnlargement: true })
      .jpeg({ quality: 95 })
      .toBuffer();

    referenceBase64 = jpegBuffer.toString("base64");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-ultra-generate-001:predict?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [
          {
            prompt: prompt,
            ...(referenceBase64 && {
              image: {
                imageBytes: referenceBase64
              }
            })
          }
        ],
        parameters: {
          sampleCount: 1,
          ...(referenceBase64 && { strength: 0.8 }),
          aspectRatio: aspectRatio && aspectRatio !== "auto"
            ? aspectRatio
            : "1:1"
        }
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("Imagen API Error:", data);
    throw new Error(data.error?.message || "Ошибка генерации изображения Imagen");
  }

  const base64Image = data.predictions?.[0]?.bytesBase64Encoded;

  if (!base64Image) {
    throw new Error("Imagen не вернул изображение");
  }

  // Сохраняем результат с максимальным качеством через Sharp
  const buffer = Buffer.from(base64Image, 'base64');
  const finalBuffer = await sharp(buffer)
    .jpeg({ quality: 100, chromaSubsampling: '4:4:4' })
    .toBuffer();

  const fileName = `${user.id}/${Date.now()}-ultra.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, finalBuffer, { contentType: 'image/jpeg' });

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    throw new Error('Не удалось сохранить сгенерированное изображение');
  }
  uploadedFiles.push(fileName);

  // Публичная ссылка
  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(fileName);

  const generationTime = Date.now() - startTime;

  // Обновляем запись
  await supabase
    .from('generations')
    .update({
      status: 'completed',
      image_url: publicUrl,
      storage_path: fileName,
      generation_time_ms: generationTime,
      is_public: isPublic,
      cost: 5,
      model_id: 'imagen-4-ultra'
    })
    .eq('id', processingRecord.id);

  return NextResponse.json({
    generationId: processingRecord.id
  });
}

/**
 * Генерация изображения через DALL-E 3 с поддержкой референс-изображения (через GPT-4 Vision).
 * Полученное изображение сохраняется без изменений.
 */
async function generateOpenAI({
  prompt,
  aspectRatio,
  imageFile,
  user,
  processingRecord,
  supabase,
  uploadedFiles,
  startTime,
  isPublic
}: any) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("API ключ OpenAI не настроен");

  const openai = new OpenAI({ apiKey });

  // Формируем финальный промпт: если есть референс, добавляем описание изображения через Vision
  let finalPrompt = prompt;

  if (imageFile) {
    // Конвертируем файл в base64 (без ресайза, так как Vision API может принять любой размер)
    const arrayBuffer = await imageFile.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');

    // Запрашиваем описание через GPT-4o
    const visionResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Опиши это изображение во всех деталях (стиль, композиция, цвета, объекты), чтобы на его основе создать похожее. Верни только описание."
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64Image}` }
            }
          ]
        }
      ],
      max_tokens: 500
    });

    const visualDescription = visionResponse.choices[0]?.message?.content;
    if (!visualDescription) {
      throw new Error("Не удалось получить описание изображения от Vision API");
    }

    // Комбинируем описание с пользовательским промптом
    finalPrompt = `На основе этого описания: ${visualDescription}. Добавь следующие изменения от пользователя: ${prompt}`;
  }

  // Определяем размер для DALL-E 3 (поддерживает только 1024x1024, 1024x1792, 1792x1024)
  let size: "1024x1024" | "1024x1792" | "1792x1024" = "1024x1024";
  
  // Все вертикальные форматы
  if (["9:16", "3:4", "4:5", "2:3"].includes(aspectRatio || "")) {
    size = "1024x1792";
  } 
  // Все широкие форматы
  else if (["16:9", "4:3", "21:9", "3:2"].includes(aspectRatio || "")) {
    size = "1792x1024";
  }

  // Генерируем изображение через DALL-E 3
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt: finalPrompt,
    n: 1,
    size: size,
    response_format: "b64_json",
  });

  const base64Image = response?.data?.[0]?.b64_json;
  if (!base64Image) throw new Error("OpenAI не вернул изображение");

  // Сохраняем в Supabase Storage без изменений
  const fileName = generateFileName(user.id, 'dalle-');
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, Buffer.from(base64Image, 'base64'), { contentType: 'image/jpeg' });

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    throw new Error('Не удалось сохранить изображение');
  }
  uploadedFiles.push(fileName);

  // Получаем публичную ссылку
  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(fileName);

  const generationTime = Date.now() - startTime;

  // Обновляем запись в БД
  await supabase
    .from('generations')
    .update({
      status: 'completed',
      image_url: publicUrl,
      storage_path: fileName,
      generation_time_ms: generationTime,
      is_public: isPublic,
      cost: 5,
      model_id: 'dall-e-3'
    })
    .eq('id', processingRecord.id);

  return NextResponse.json({
    generationId: processingRecord.id
  });
}