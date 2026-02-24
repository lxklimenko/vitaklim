import { NextResponse } from "next/server";
import { createClient } from '@/app/lib/supabase-server';
import sharp from "sharp";
import crypto from 'crypto';

// Константы
const GENERATION_COST = parseInt(process.env.GENERATION_COST || "1", 10);
const STORAGE_BUCKET = 'generations-private';
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
  let processingRecord: any = null; // Будет хранить созданную запись генерации
  let user: any = null; // Объявляем переменную user здесь, чтобы она была доступна в catch

  try {
    // 1. Аутентификация
    const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
    if (!authUser || userError) {
      return NextResponse.json(
        { error: "Вы не авторизованы" },
        { status: 401 }
      );
    }
    user = authUser; // присваиваем в переменную из внешней области

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

    // 🔥 Проверка, что модель поддерживает генерацию изображений
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

    // 🔒 Проверка: есть ли активная генерация
    const { data: activeGeneration } = await supabase
      .from('generations')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (activeGeneration) {
      return NextResponse.json(
        { error: "У вас уже запущена генерация. Дождитесь завершения." },
        { status: 429 }
      );
    }

    // 🟡 Создаём временную запись со статусом pending
    const { data: newProcessingRecord, error: processingError } = await supabase
      .from('generations')
      .insert({
        user_id: user.id,
        prompt,
        status: 'pending'
      })
      .select()
      .single();

    // Обработка ошибки уникального pending
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

    processingRecord = newProcessingRecord; // сохраняем для дальнейшего использования

    // 💰 Списываем баланс ДО генерации
    const { data: rpcResult, error: rpcError } = await supabase
      .rpc('create_generation', {
        p_user_id: user.id,
        p_cost: GENERATION_COST
      });

    if (rpcError) {
      throw new Error('Не удалось выполнить операцию списания средств');
    }

    const result = rpcResult as RpcResult;

    if (!result.success) {
      throw new Error(result.error || "Не удалось списать средства");
    }

    // 4. Проверка наличия API-ключа
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.error('Google API key not configured');
      throw new Error("Сервис временно недоступен (ошибка конфигурации)");
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
        throw new Error(imgError instanceof Error ? imgError.message : "Ошибка обработки изображения");
      }
    }

    const requestBody = {
      contents: [{ parts }]
    };

    // 6. Формируем URL для Gemini API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

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
      throw new Error("Ошибка сети при обращении к API генерации");
    }

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", data);
      const errorMessage = data.error?.message || "Ошибка генерации изображения";
      throw new Error(errorMessage);
    }

    // 8. Извлечение сгенерированного изображения (base64)
    const candidate = data.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
    
    if (!imagePart) {
      // Модель могла вернуть текст
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

    // ✅ Обновляем запись после успешной генерации
    if (processingRecord) {
      await supabase
        .from('generations')
        .update({
          status: 'completed',
          image_url: null,
          storage_path: fileName,
          reference_image_url: referencePublicUrl,
          reference_storage_path: referenceFileName,
          generation_time_ms: generationTime
        })
        .eq('id', processingRecord.id);
    }

    // 12. Успех
    return NextResponse.json({ imageUrl: null });

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

    // ❌ Обновляем статус записи на failed, если она была создана
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

    // 💸 Возврат средств при ошибке (если пользователь аутентифицирован)
    if (user?.id) {
      try {
        await supabase.rpc('refund_generation', {
          p_generation_id: processingRecord?.id, // добавлен идентификатор генерации
          p_user_id: user.id,
          p_amount: GENERATION_COST
        });
      } catch (refundError) {
        console.error("Refund error:", refundError);
      }
    }

    const message =
      error instanceof Error ? error.message : "Внутренняя ошибка сервера";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}