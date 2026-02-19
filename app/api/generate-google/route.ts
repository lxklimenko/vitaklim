import { NextResponse } from "next/server";
import { createClient } from '@/app/lib/supabase-server';
import sharp from "sharp";

// Стоимость одной генерации (можно вынести в переменные окружения)
const GENERATION_COST = 1;

// Модели, которые относятся к семейству Gemini (поддержка изображений)
const GEMINI_IMAGE_MODELS = [
  'gemini-2.0-flash-exp-image-generation',
  'gemini-2.0-flash-exp',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  // при необходимости дополните список
];

export async function POST(req: Request) {
  try {
    // Создаём клиент Supabase
    const supabase = await createClient();

    // Проверяем авторизацию
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (!user || userError) {
      return NextResponse.json({ error: "Вы не авторизованы" }, { status: 401 });
    }

    // Получаем и валидируем входные параметры
    const { prompt, aspectRatio, modelId, image } = await req.json();
    if (!prompt || !modelId) {
      return NextResponse.json(
        { error: "Не указан prompt или modelId" },
        { status: 400 }
      );
    }

    // Проверяем наличие API-ключа Google
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.error('Google API key not configured');
      return NextResponse.json(
        { error: "API ключ не настроен" },
        { status: 500 }
      );
    }

    // Определяем, относится ли модель к семейству Gemini (генерация с изображением на входе)
    const isGeminiModel = GEMINI_IMAGE_MODELS.some(name => modelId.includes(name));

    // Метод API в зависимости от модели
    const method = isGeminiModel ? "generateContent" : "predict";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:${method}?key=${apiKey}`;

    // === Проверка баланса перед вызовом платного API ===
    const { data: balance, error: balanceCheckError } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', user.id)
      .single();

    if (balanceCheckError || !balance) {
      console.error('Balance check failed:', balanceCheckError);
      return NextResponse.json(
        { error: "Не удалось проверить баланс" },
        { status: 500 }
      );
    }

    if (balance.balance < GENERATION_COST) {
      return NextResponse.json(
        { error: "Недостаточно средств на балансе" },
        { status: 400 }
      );
    }

    // Формируем тело запроса в зависимости от типа модели
    let requestBody;

    if (isGeminiModel) {
      // Gemini: поддерживает текстовый prompt и опциональное изображение
      const parts: any[] = [{ text: prompt }];

      if (image) {
        try {
          // Извлекаем base64-данные (ожидается data:image/...;base64,...)
          const base64Data = image.split(',')[1];
          if (!base64Data) {
            throw new Error('Неверный формат изображения');
          }

          const inputBuffer = Buffer.from(base64Data, "base64");

          // Оптимизируем изображение: уменьшаем размер, конвертируем в JPEG
          const jpegBuffer = await sharp(inputBuffer)
            .resize({ width: 2048, withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toBuffer();

          console.log("Optimized image size (KB):", Math.round(jpegBuffer.length / 1024));

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
      // Imagen: только текст, с указанием соотношения сторон
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

    // Вызываем Google API
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
      // Пробрасываем понятную ошибку пользователю
      const errorMessage = data.error?.message || "Ошибка генерации изображения";
      return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    // Извлекаем сгенерированное изображение (base64)
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

    // Сохраняем результат в Supabase Storage
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

    // Если было передано reference-изображение, сохраняем его отдельно
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

    // Атомарно списываем средства и записываем генерацию через RPC
    // Предполагается, что в БД есть функция, которая:
    // - проверяет баланс,
    // - уменьшает его на GENERATION_COST,
    // - вставляет запись в generations,
    // - возвращает true при успехе.
    // Если такой функции нет, можно выполнить два шага вручную, но это не атомарно.
    // Для простоты оставим два шага, но с повторной проверкой баланса перед вставкой.
    // В production рекомендуется создать хранимую процедуру.

    // Повторно проверяем баланс (на случай, если изменился во время генерации)
    const { data: freshBalance, error: freshBalanceError } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', user.id)
      .single();

    if (freshBalanceError || !freshBalance) {
      throw new Error('Не удалось проверить баланс после генерации');
    }

    if (freshBalance.balance < GENERATION_COST) {
      // Недостаточно средств — удаляем загруженное изображение, чтобы не оставлять мусор
      await supabase.storage.from('generations').remove([fileName]);
      if (referenceFileName) {
        await supabase.storage.from('generations').remove([referenceFileName]);
      }
      return NextResponse.json(
        { error: "Недостаточно средств на балансе" },
        { status: 400 }
      );
    }

    // Уменьшаем баланс
    const { error: decrementError } = await supabase
      .rpc('decrement_balance', { user_id: user.id, amount: GENERATION_COST });

    if (decrementError) {
      console.error('Decrement balance error:', decrementError);
      // В случае ошибки удаляем загруженные файлы, чтобы не оставлять бесплатные генерации
      await supabase.storage.from('generations').remove([fileName]);
      if (referenceFileName) {
        await supabase.storage.from('generations').remove([referenceFileName]);
      }
      throw new Error('Не удалось списать средства');
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
      console.error('DB insert error:', dbError);
      // Вставляем запись не удалась, но баланс уже списан — нужно вернуть средства?
      // Это сложная ситуация, лучше использовать транзакцию.
      // Пока просто логируем и возвращаем ошибку.
      // В идеале — создать RPC, который делает всё вместе.
      throw new Error('Не удалось сохранить историю генерации');
    }

    // Успех
    return NextResponse.json({ imageUrl: publicUrl });

  } catch (error: any) {
    console.error("Server Error:", error);
    return NextResponse.json(
      { error: error.message || "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}