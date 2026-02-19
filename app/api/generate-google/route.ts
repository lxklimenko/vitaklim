import { NextResponse } from "next/server";
import { createClient } from '@/app/lib/supabase-server';
import sharp from "sharp";

export async function POST(req: Request) {
  try {
    // Создаём клиент Supabase один раз и используем во всей функции
    const supabase = await createClient();

    // Проверяем авторизацию пользователя
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (!user || userError) {
      return NextResponse.json(
        { error: "Вы не авторизованы" },
        { status: 401 }
      );
    }

    // Получаем параметры запроса
    const { prompt, aspectRatio, modelId, image } = await req.json();

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API ключ не настроен" }, { status: 500 });
    }

    // Определяем семейство модели (Gemini или Imagen)
    const isNanoBanana = modelId.includes("nano-banana") || modelId.includes("gemini-3");
    const method = isNanoBanana ? "generateContent" : "predict";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:${method}?key=${apiKey}`;

    // Формируем тело запроса в зависимости от модели
    let body;

    if (isNanoBanana) {
      // Gemini (Nano Banana Pro)
      const parts: any[] = [{ text: prompt }];

      if (image) {
        const base64Data = image.split(',')[1];
        const inputBuffer = Buffer.from(base64Data, "base64");

        // 🔥 1. Уменьшаем размер
        // 🔥 2. Конвертируем в JPEG
        const jpegBuffer = await sharp(inputBuffer)
          .resize({
            width: 2048,              // ограничиваем ширину
            withoutEnlargement: true  // не увеличиваем маленькие изображения
          })
          .jpeg({ quality: 85 })      // уменьшаем вес
          .toBuffer();

        console.log("Final image size (KB):", Math.round(jpegBuffer.length / 1024));

        const finalBase64 = jpegBuffer.toString("base64");

        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: finalBase64
          }
        });
      }

      body = {
        contents: [{ parts }],
        generationConfig: { candidateCount: 1 }
      };
    } else {
      // Imagen 4 (Ultra / Fast)
      const instance: any = { prompt };

      body = {
        instances: [instance],
        parameters: {
          sampleCount: 1,
          aspectRatio: aspectRatio === "auto" ? "1:1" : aspectRatio,
          outputOptions: { mimeType: "image/jpeg" }
        }
      };
    }

    // Отправляем запрос к Google API
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("API Error Details:", data);
      throw new Error(data.error?.message || "Ошибка генерации изображения");
    }

    // Извлекаем сгенерированное изображение из ответа
    let base64Image: string;

    if (isNanoBanana) {
      const candidate = data.candidates?.[0];
      const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
      if (!imagePart) {
        throw new Error("Модель не вернула изображение. Проверьте промпт на безопасность.");
      }
      base64Image = imagePart.inlineData.data;
    } else {
      if (!data.predictions?.[0]?.bytesBase64Encoded) {
        throw new Error("Изображение не найдено в ответе модели.");
      }
      base64Image = data.predictions[0].bytesBase64Encoded;
    }

    // Сохраняем результат в Supabase Storage
    const buffer = Buffer.from(base64Image, 'base64');
    const fileName = `${user.id}/${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('generations')
      .upload(fileName, buffer, { contentType: 'image/jpeg' });

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('generations')
      .getPublicUrl(fileName);

    // Если была передана reference-картинка, сохраняем её тоже (опционально)
    let referencePublicUrl: string | null = null;
    let referenceFileName: string | null = null;

    if (image) {
      try {
        const referenceBase64 = image.split(',')[1];
        const referenceBuffer = Buffer.from(referenceBase64, 'base64');
        const refFileName = `${user.id}/reference-${Date.now()}.jpg`;

        const { error: refUploadError } = await supabase.storage
          .from('generations')
          .upload(refFileName, referenceBuffer, { contentType: 'image/jpeg' });

        if (!refUploadError) {
          const { data: { publicUrl: refUrl } } = supabase.storage
            .from('generations')
            .getPublicUrl(refFileName);

          referencePublicUrl = refUrl;
          referenceFileName = refFileName;
        } else {
          console.error("Ошибка сохранения reference-изображения:", refUploadError);
        }
      } catch (refError) {
        console.error("Не удалось обработать reference-изображение:", refError);
        // Продолжаем без reference, не прерываем основной процесс
      }
    }

    // Сохраняем запись в таблицу generations
    const { error: dbError } = await supabase
      .from('generations')
      .insert({
        user_id: user.id,
        prompt,
        image_url: publicUrl,
        storage_path: fileName,
        reference_image_url: referencePublicUrl,
        reference_storage_path: referenceFileName,
        is_favorite: false
      });

    if (dbError) {
      throw dbError;
    }

    // Атомарно уменьшаем баланс пользователя
    const { data: balanceResult, error: balanceError } = await supabase
      .rpc('decrement_balance', { user_id: user.id });

    if (balanceError) {
      throw balanceError;
    }

    if (!balanceResult) {
      return NextResponse.json(
        { error: "Недостаточно средств на балансе" },
        { status: 400 }
      );
    }

    // Возвращаем ссылку на сгенерированное изображение
    return NextResponse.json({ imageUrl: publicUrl });

  } catch (error: any) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}