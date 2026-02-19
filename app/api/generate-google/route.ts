import { NextResponse } from "next/server";
import { createClient } from '@/app/lib/supabase-server';
import sharp from "sharp";
import crypto from 'crypto';

// Константы
const GENERATION_COST = parseInt(process.env.GENERATION_COST || "1", 10);
const STORAGE_BUCKET = 'generations';
const FETCH_TIMEOUT = 60000; // 60 секунд для генерации изображения
const MAX_IMAGE_SIZE_MB = 10;
const ALLOWED_ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'];

// Модели Gemini, поддерживающие изображения на входе
const GEMINI_IMAGE_MODELS = [
  'gemini-2.0-flash-exp-image-generation',
  'gemini-2.0-flash-exp',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
];

interface GenerationRequest {
  prompt: string;
  aspectRatio?: string;
  modelId: string;
  imageFile?: File; // теперь это File, а не строка base64
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

export async function POST(req: Request) {
  const supabase = await createClient();

  try {
    // 1. Аутентификация
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (!user || userError) {
      return NextResponse.json(
        { error: "Вы не авторизованы" },
        { status: 401 }
      );
    }

    // 2. Парсинг multipart/form-data
    const formData = await req.formData();
    const prompt = formData.get('prompt')?.toString();
    const aspectRatio = formData.get('aspectRatio')?.toString();
    const modelId = formData.get('modelId')?.toString();
    const imageFile = formData.get('image') as File | null; // поле может называться "image"

    if (!prompt?.trim() || !modelId) {
      return NextResponse.json(
        { error: "Не указан prompt или modelId" },
        { status: 400 }
      );
    }

    // 3. Проверка баланса пользователя
    const { data: balanceData, error: balanceError } = await supabase
      .rpc('get_user_balance', { p_user_id: user.id });

    if (balanceError) {
      console.error('Balance check error:', balanceError);
      return NextResponse.json(
        { error: "Ошибка проверки баланса" },
        { status: 500 }
      );
    }

    const currentBalance = balanceData || 0;
    if (currentBalance < GENERATION_COST) {
      return NextResponse.json(
        { error: "Недостаточно средств на счете" },
        { status: 402 }
      );
    }

    // 4. Проверка API-ключа Google
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.error('Google API key not configured');
      return NextResponse.json(
        { error: "API ключ не настроен" },
        { status: 500 }
      );
    }

    // 5. Определяем тип модели и метод API
    const isGeminiModel = GEMINI_IMAGE_MODELS.some(name => modelId.includes(name));
    const method = isGeminiModel ? "generateContent" : "predict";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:${method}?key=${apiKey}`;

    // 6. Формируем тело запроса к Google API
    let requestBody: unknown;
    let processedImageBuffer: Buffer | null = null; // сохраним для reference

    if (isGeminiModel) {
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        { text: prompt }
      ];

      if (imageFile) {
        try {
          // Проверка размера файла
          if (imageFile.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
            throw new Error(`Размер изображения превышает ${MAX_IMAGE_SIZE_MB} МБ`);
          }

          const arrayBuffer = await imageFile.arrayBuffer();
          const inputBuffer = Buffer.from(arrayBuffer);

          // Оптимизация изображения для отправки в Gemini
          const jpegBuffer = await sharp(inputBuffer)
            .resize({ width: 2048, withoutEnlargement: true })
            .jpeg({ quality: 90 })
            .toBuffer();

          parts.push({
            inlineData: {
              mimeType: "image/jpeg",
              data: jpegBuffer.toString("base64")
            }
          });

          // Сохраняем обработанный буфер для возможного сохранения как reference
          processedImageBuffer = jpegBuffer;
        } catch (imgError) {
          console.error('Image processing error:', imgError);
          return NextResponse.json(
            { error: imgError instanceof Error ? imgError.message : "Ошибка обработки изображения" },
            { status: 400 }
          );
        }
      }

      requestBody = {
        contents: [{ parts }],
        generationConfig: { candidateCount: 1 }
      };
    } else {
      // Imagen — только текст + соотношение сторон
      let safeAspectRatio = '1:1';
      if (aspectRatio && aspectRatio !== 'auto') {
        if (ALLOWED_ASPECT_RATIOS.includes(aspectRatio)) {
          safeAspectRatio = aspectRatio;
        } else {
          console.warn(`Неподдерживаемый aspectRatio: ${aspectRatio}, используется 1:1`);
        }
      }

      requestBody = {
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: safeAspectRatio,
          outputOptions: { mimeType: "image/jpeg" }
        }
      };
    }

    // 7. Вызов Google API с таймаутом
    let response: Response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
    } catch (fetchError) {
      console.error('Network error calling Google API:', fetchError);
      return NextResponse.json(
        { error: "Ошибка сети при обращении к API генерации" },
        { status: 502 }
      );
    }

    const data = await response.json();

    if (!response.ok) {
      console.error("Google API Error:", data);
      const errorMessage = data.error?.message || "Ошибка генерации изображения";
      return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    // 8. Извлечение сгенерированного изображения (base64)
    let base64Image: string;

    if (isGeminiModel) {
      const candidate = data.candidates?.[0];
      const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
      if (!imagePart) {
        throw new Error("Модель не вернула изображение. Возможно, промпт был заблокирован.");
      }
      base64Image = imagePart.inlineData.data;
    } else {
      if (!data.predictions?.[0]?.bytesBase64Encoded) {
        throw new Error("Изображение не найдено в ответе модели.");
      }
      base64Image = data.predictions[0].bytesBase64Encoded;
    }

    // 9. Сохраняем результат в Storage
    const buffer = Buffer.from(base64Image, 'base64');
    const fileName = generateFileName(user.id);

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, buffer, { contentType: 'image/jpeg' });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error('Не удалось сохранить сгенерированное изображение');
    }

    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);

    // 10. Если было передано reference-изображение, сохраняем его обработанную версию
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
        } else {
          console.error("Ошибка сохранения reference-изображения:", refUploadError);
        }
      } catch (refError) {
        console.error("Не удалось сохранить reference-изображение:", refError);
      }
    }

    // 11. Атомарное списание средств и сохранение истории через RPC
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('create_generation', {
        p_user_id: user.id,
        p_prompt: prompt,
        p_image_url: publicUrl,
        p_storage_path: fileName,
        p_reference_image_url: referencePublicUrl,
        p_reference_storage_path: referenceFileName,
        p_cost: GENERATION_COST
      });

    if (rpcError) {
      console.error('RPC error:', rpcError);
      // Если RPC завершился ошибкой, удаляем загруженные файлы
      await supabase.storage.from(STORAGE_BUCKET).remove([fileName]);
      if (referenceFileName) {
        await supabase.storage.from(STORAGE_BUCKET).remove([referenceFileName]);
      }
      throw new Error('Не удалось выполнить операцию списания средств');
    }

    // Проверяем результат, возвращённый функцией
    const result = rpcResult as RpcResult;
    if (!result.success) {
      // Недостаточно средств или другая логическая ошибка
      await supabase.storage.from(STORAGE_BUCKET).remove([fileName]);
      if (referenceFileName) {
        await supabase.storage.from(STORAGE_BUCKET).remove([referenceFileName]);
      }
      return NextResponse.json(
        { error: result.error || "Не удалось списать средства" },
        { status: 400 }
      );
    }

    // 12. Успех
    return NextResponse.json({ imageUrl: publicUrl });

  } catch (error: unknown) {
    console.error("Server Error:", error);
    const message = error instanceof Error ? error.message : "Внутренняя ошибка сервера";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}