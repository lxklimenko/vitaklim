import { NextResponse } from "next/server";
import { createClient } from '@/app/lib/supabase-server';

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

    // === ШАГ 6: Проверяем баланс ===
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      throw new Error("Профиль не найден");
    }

    if (profile.balance <= 0) {
      return NextResponse.json(
        { error: "Недостаточно баланса" },
        { status: 400 }
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
        const mimeType = image.split(';')[0].split(':')[1];
        
        parts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Data
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

    // Сохраняем запись в таблицу generations
    const { error: dbError } = await supabaseStorage
      .from('generations')
      .insert({
        user_id: currentUser.id,
        prompt,
        image_url: publicUrl,
        is_favorite: false
      });

    if (dbError) {
      throw dbError;
    }

    // === ШАГ 7: Уменьшаем баланс на 1 ===
    await supabase
      .from('profiles')
      .update({ balance: profile.balance - 1 })
      .eq('id', user.id);

    return NextResponse.json({ imageUrl: publicUrl });

  } catch (error: any) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}