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
      // Работает и с текстом, и с фото.
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
        // Оставляем пустой конфиг, так как aspect_ratio здесь вызывал ошибку
        generationConfig: {
          candidateCount: 1
        }
      };
    } else {
      // 2. ЛОГИКА ДЛЯ IMAGEN 4 (Ultra и Fast)
      // ВАЖНО: Эти модели поддерживают ТОЛЬКО текст. 
      // Если передать поле 'image', будет ошибка "Image in input is not supported".
      const instance: any = { prompt };

      body = {
        instances: [instance],
        parameters: {
          sampleCount: 1,
          // Imagen 4 принимает пропорции в формате camelCase (aspectRatio)
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

    // Извлекаем картинку в зависимости от структуры ответа модели
    let base64Image;
    if (isNanoBanana) {
      const candidate = data.candidates?.[0];
      const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
      
      if (!imagePart) {
        throw new Error("Модель не вернула изображение. Проверьте промпт на безопасность.");
      }
      base64Image = imagePart.inlineData.data;
    } else {
      // Для Imagen 4 (Ultra / Fast)
      if (!data.predictions?.[0]?.bytesBase64Encoded) {
        throw new Error("Изображение не найдено в ответе модели.");
      }
      base64Image = data.predictions[0].bytesBase64Encoded;
    }

    return NextResponse.json({ 
      imageUrl: `data:image/jpeg;base64,${base64Image}` 
    });

  } catch (error: any) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}