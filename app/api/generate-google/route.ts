import { NextResponse } from "next/server";
import { createClient } from '@/app/lib/supabase-server';
import sharp from "sharp";

// Стоимость генерации (можно задать через переменную окружения)
const GENERATION_COST = parseInt(process.env.GENERATION_COST || "1", 10);

// Модели Gemini, поддерживающие изображения на входе
const GEMINI_IMAGE_MODELS = [
  'gemini-2.0-flash-exp-image-generation',
  'gemini-2.0-flash-exp',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
];

export async function POST(req: Request) {
  const supabase = await createClient();

  try {
    // 1. Аутентификация
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (!user || userError) {
      return NextResponse.json({ error: "Вы не авторизованы" }, { status: 401 });
    }

    // 2. Валидация входных данных
    const { prompt, aspectRatio, modelId, image } = await req.json();
    if (!prompt || !modelId) {
      return NextResponse.json(
        { error: "Не указан prompt или modelId" },
        { status: 400 }
      );
    }

    // 3. Проверка API-ключа Google
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.error('Google API key not configured');
      return NextResponse.json(
        { error: "API ключ не настроен" },
        { status: 500 }
      );
    }

    // 4. Определяем тип модели и метод API
    const isGeminiModel = GEMINI_IMAGE_MODELS.some(name => modelId.includes(name));
    const method = isGeminiModel ? "generateContent" : "predict";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:${method}?key=${apiKey}`;

    // 5. Формируем тело запроса к Google API
    let requestBody;

    if (isGeminiModel) {
      const parts: any[] = [{ text: prompt }];

      if (image) {
        try {
          const base64Data = image.split(',')[1];
          if (!base64Data) throw new Error('Неверный формат изображения');

          const inputBuffer = Buffer.from(base64Data, "base64");
          const jpegBuffer = await sharp(inputBuffer)
            .resize({ width: 2048, withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();

          parts.push({
            inlineData: {
              mimeType: "image/jpeg",
              data: jpegBuffer.toString("base64")
            }
          });
        } catch (imgError) {
          console.error('Image processing error:', imgError);
          return NextResponse.json(
            { error: "Ошибка обработки изображения" },
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
      const instance: any = { prompt };
      requestBody = {
        instances: [instance],
        parameters: {
          sampleCount: 1,
          aspectRatio: aspectRatio === "auto" ? "1:1" : (aspectRatio || "1:1"),
          outputOptions: { mimeType: "image/jpeg" }
        }
      };
    }

    // 6. Вызов Google API
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
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

    // 7. Извлечение сгенерированного изображения (base64)
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

    // 8. Сохраняем результат в Storage
    const buffer = Buffer.from(base64Image, 'base64');
    const fileName = `${user.id}/${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('generations')
      .upload(fileName, buffer, { contentType: 'image/jpeg' });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error('Не удалось сохранить сгенерированное изображение');
    }

    const { data: { publicUrl } } = supabase.storage
      .from('generations')
      .getPublicUrl(fileName);

    // 9. Если передано reference-изображение, обрабатываем и сохраняем его (но окончательно запишем только после успешной транзакции)
    let referencePublicUrl: string | null = null;
    let referenceFileName: string | null = null;

    if (image) {
      try {
        const refBase64 = image.split(',')[1];
        if (refBase64) {
          const refBuffer = Buffer.from(refBase64, 'base64');
          const refFileName = `${user.id}/reference-${Date.now()}.jpg`;

          const { error: refUploadError } = await supabase.storage
            .from('generations')
            .upload(refFileName, refBuffer, { contentType: 'image/jpeg' });

          if (!refUploadError) {
            const { data: { publicUrl: refUrl } } = supabase.storage
              .from('generations')
              .getPublicUrl(refFileName);
            referencePublicUrl = refUrl;
            referenceFileName = refFileName;
          } else {
            console.error("Ошибка сохранения reference-изображения:", refUploadError);
          }
        }
      } catch (refError) {
        console.error("Не удалось обработать reference-изображение:", refError);
        // Продолжаем без reference
      }
    }

    // 10. Атомарное списание средств и сохранение истории через RPC
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
      await supabase.storage.from('generations').remove([fileName]);
      if (referenceFileName) {
        await supabase.storage.from('generations').remove([referenceFileName]);
      }
      throw new Error('Не удалось выполнить операцию списания средств');
    }

    // Проверяем результат, возвращённый функцией (если она возвращает json)
    if (!rpcResult?.success) {
      // Недостаточно средств или другая логическая ошибка
      await supabase.storage.from('generations').remove([fileName]);
      if (referenceFileName) {
        await supabase.storage.from('generations').remove([referenceFileName]);
      }
      return NextResponse.json(
        { error: rpcResult?.error || "Не удалось списать средства" },
        { status: 400 }
      );
    }

    // 11. Успех
    return NextResponse.json({ imageUrl: publicUrl });

  } catch (error: any) {
    console.error("Server Error:", error);
    return NextResponse.json(
      { error: error.message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}