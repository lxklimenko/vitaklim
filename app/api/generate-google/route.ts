import { NextResponse } from "next/server";
import { createClient } from '@/app/lib/supabase-server';
import sharp from "sharp";
import crypto from 'crypto';

// Константы
const GENERATION_COST = parseInt(process.env.GENERATION_COST || "1", 10);
const STORAGE_BUCKET = 'generations';
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

  try {
    // 1. Аутентификация
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (!user || userError) {
      return NextResponse.json(
        { error: "Вы не авторизованы" },
        { status: 401 }
      );
    }

    // Засекаем время начала генерации
    const startTime = Date.now();

    // 2. Парсинг multipart/form-data
    const formData = await req.formData();
    const prompt = formData.get('prompt')?.toString();
    const aspectRatio = formData.get('aspectRatio')?.toString();
    const modelId = formData.get('modelId')?.toString();
    const imageFile = formData.get('image') as File | null;

    if (!prompt?.trim()) {
      return NextResponse.json(
        { error: "Не указан prompt" },
        { status: 400 }
      );
    }

    // Проверка наличия modelId
    if (!modelId) {
      return NextResponse.json(
        { error: "Не указана модель" },
        { status: 400 }
      );
    }

    // 🔥 Проверка, что модель поддерживает генерацию изображений (новый список)
    const IMAGE_MODELS = [
      "gemini-3-pro-image-preview",
      "gemini-2.5-flash-image"
    ];

    if (!IMAGE_MODELS.includes(modelId)) {
      return NextResponse.json(
        { error: "Модель не поддерживает генерацию изображений" },
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

    // 🔒 Anti-spam защита: не чаще 1 генерации раз в 3 секунды
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

    // 4. Проверка наличия API-ключа
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.error('Google API key not configured');
      return NextResponse.json(
        { error: "Сервис временно недоступен (ошибка конфигурации)" },
        { status: 500 }
      );
    }

    // 5. Формируем тело запроса для Gemini API
    let processedImageBuffer: Buffer | null = null; // для сохранения reference-изображения

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: prompt }
    ];

    if (imageFile) {
      try {
        // Проверка размера файла
        if (imageFile.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
          throw new Error(`Размер изображения превышает ${MAX_IMAGE_SIZE_MB} МБ`);
        }

        // Проверка MIME-типа
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

    const requestBody = {
      contents: [{ parts }],
      generation_config: {
        response_modalities: ["image"],
        temperature: 0.9
      }
    };

    // 6. Формируем URL для Gemini API (используем v1) – динамически подставляем modelId
    const url = `https://generativelanguage.googleapis.com/v1/models/${modelId}:generateContent?key=${apiKey}`;

    // 7. Вызов Gemini API с таймаутом и ретраем при временных ошибках
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

      // 🔁 Retry если временная ошибка
      if (response.status === 429 || response.status === 503) {
        console.warn("Gemini API temporary error, retrying...");
        await new Promise(resolve => setTimeout(resolve, 1000));
        response = await makeRequest();
      }

    } catch (fetchError) {
      console.error('Network error calling Gemini API:', fetchError);
      return NextResponse.json(
        { error: "Ошибка сети при обращении к API генерации" },
        { status: 502 }
      );
    }

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", data);
      const errorMessage = data.error?.message || "Ошибка генерации изображения";
      return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    // 8. Извлечение сгенерированного изображения (base64)
    const candidate = data.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
    
    if (!imagePart) {
      // Модель могла вернуть текст (например, если промпт заблокирован)
      const textPart = candidate?.content?.parts?.find((part: any) => part.text);
      const errorText = textPart?.text || "Модель не вернула изображение. Возможно, промпт был заблокирован.";
      throw new Error(errorText);
    }

    const base64Image = imagePart.inlineData.data;

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
    uploadedFiles.push(fileName);

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
          uploadedFiles.push(refFileName);
        } else {
          console.error("Ошибка сохранения reference-изображения:", refUploadError);
        }
      } catch (refError) {
        console.error("Не удалось сохранить reference-изображение:", refError);
      }
    }

    // Вычисляем время генерации в миллисекундах
    const generationTime = Date.now() - startTime;

    // 11. Атомарное списание средств и сохранение истории через RPC
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('create_generation', {
        p_user_id: user.id,
        p_prompt: prompt,
        p_image_url: publicUrl,
        p_storage_path: fileName,
        p_reference_image_url: referencePublicUrl,
        p_reference_storage_path: referenceFileName,
        p_cost: GENERATION_COST,
        p_generation_time_ms: generationTime
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

    // 🧹 Гарантированная очистка загруженных файлов
    if (uploadedFiles.length > 0) {
      try {
        await supabase.storage
          .from(STORAGE_BUCKET)
          .remove(uploadedFiles);
      } catch (cleanupError) {
        console.error("Cleanup error:", cleanupError);
      }
    }

    const message =
      error instanceof Error ? error.message : "Внутренняя ошибка сервера";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}