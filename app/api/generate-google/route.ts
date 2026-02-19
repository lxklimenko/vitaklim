import { NextResponse } from "next/server";
import { createClient } from '@/app/lib/supabase-server';
import sharp from "sharp";

export async function POST(req: Request) {
  try {
    // Проверяем пользователя
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (!user || userError) {
      return NextResponse.json(
        { error: "Вы не авторизованы" },
        { status: 401 }
      );
    }

    const { prompt, aspectRatio, modelId, image } = await req.json();
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) return NextResponse.json({ error: "No API Key" }, { status: 500 });

    // Определяем семейство модели
    const isNanoBanana = modelId.includes("nano-banana") || modelId.includes("gemini-3");
    const method = isNanoBanana ? "generateContent" : "predict";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:${method}?key=${apiKey}`;

    let body;

    if (isNanoBanana) {
      // 1. ЛОГИКА ДЛЯ NANO BANANA PRO (Gemini 3 Pro)
      const parts: any[] = [{ text: prompt }];
      
      if (image) {
        const base64Data = image.split(',')[1];
        const inputBuffer = Buffer.from(base64Data, "base64");

        // 🔥 Конвертируем всё в JPEG
        const jpegBuffer = await sharp(inputBuffer)
          .jpeg({ quality: 90 })
          .toBuffer();

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
        generationConfig: {
          candidateCount: 1
        }
      };
    } else {
      // 2. ЛОГИКА ДЛЯ IMAGEN 4 (Ultra и Fast)
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

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error("API Error Details:", data);
      throw new Error(data.error?.message || "Ошибка генерации");
    }

    // Извлекаем картинку
    let base64Image;
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

    // Сохраняем в Supabase Storage
    const supabaseStorage = await createClient(); // можно использовать уже созданный supabase, но оставим как есть

    const { data: { user: currentUser } } = await supabaseStorage.auth.getUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "Вы не авторизованы" },
        { status: 401 }
      );
    }

    const buffer = Buffer.from(base64Image, 'base64');
    // Готовим переменные для ссылки и пути reference (если он есть)
    let referencePublicUrl: string | null = null;
    let referenceFileName: string | null = null;   // <-- объявляем переменную для пути reference

    const fileName = `${currentUser.id}/${Date.now()}.jpg`;

    const { error: uploadError } = await supabaseStorage.storage
      .from('generations')
      .upload(fileName, buffer, {
        contentType: 'image/jpeg'
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = supabaseStorage.storage
      .from('generations')
      .getPublicUrl(fileName);

    // Если есть reference-картинка — сохраняем её тоже
    if (image) {
      const referenceBase64 = image.split(',')[1];
      const referenceBuffer = Buffer.from(referenceBase64, 'base64');
      const refFileName = `${currentUser.id}/reference-${Date.now()}.jpg`;   // временная переменная

      const { error: refUploadError } = await supabaseStorage.storage
        .from('generations')
        .upload(refFileName, referenceBuffer, {
          contentType: 'image/jpeg'
        });

      if (!refUploadError) {
        const { data: { publicUrl: refUrl } } = supabaseStorage.storage
          .from('generations')
          .getPublicUrl(refFileName);

        referencePublicUrl = refUrl;
        referenceFileName = refFileName;   // сохраняем путь только при успешной загрузке
      }
    }

    // Сохраняем запись в таблицу generations
    const { error: dbError } = await supabaseStorage
      .from('generations')
      .insert({
        user_id: currentUser.id,
        prompt,
        image_url: publicUrl,
        storage_path: fileName,
        reference_image_url: referencePublicUrl,
        reference_storage_path: referenceFileName,   // <-- новое поле
        is_favorite: false
      });

    if (dbError) {
      throw dbError;
    }

    // Атомарно уменьшаем баланс
    const { data: balanceResult, error: balanceError } = await supabase
      .rpc('decrement_balance', { user_id: user.id });

    if (balanceError) {
      throw balanceError;
    }

    if (!balanceResult) {
      return NextResponse.json(
        { error: "Недостаточно баланса" },
        { status: 400 }
      );
    }

    return NextResponse.json({ imageUrl: publicUrl });

  } catch (error: any) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}