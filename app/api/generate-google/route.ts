import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt, aspectRatio, modelId, image } = await req.json();
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) return NextResponse.json({ error: "No API Key" }, { status: 500 });

    // Определяем семейство модели
    const isNanoBanana = modelId.includes("nano-banana") || modelId.includes("gemini-3");
    const method = isNanoBanana ? "generateContent" : "predict";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:${method}?key=${apiKey}`;

    let body;

    if (isNanoBanana) {
      // 1. Формируем "части" запроса (текст + опционально фото)
      const parts: any[] = [{ text: prompt }];
      
      if (image) {
        // Извлекаем чистый base64 и mimeType
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
          // ИСПРАВЛЕНИЕ: В Gemini 3 параметр называется строго aspect_ratio
          // и он находится ПРЯМО в generationConfig без лишних вложений
          aspect_ratio: aspectRatio === "auto" ? "1:1" : aspectRatio,
          // Можно добавить количество вариантов (обычно 1 для экономии)
          candidateCount: 1
        }
      };
    } else {
      // 2. ЛОГИКА ДЛЯ IMAGEN 4 (Ultra и Fast)
      // Использует predict. Большинство Vertex-моделей Imagen 4 
      // сейчас работают как Text-to-Image.
      const instance: any = { prompt };

      // Если модель поддерживает Image-to-Image через predict, передаем картинку
      if (image) {
        instance.image = {
          bytesBase64Encoded: image.split(',')[1]
        };
      }

      body = {
        instances: [instance],
        parameters: {
          sampleCount: 1,
          // ВАЖНО: Imagen требует camelCase (aspectRatio)
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
      console.error("Nano Banana API Error:", data);
      throw new Error(data.error?.message || "Ошибка генерации Nano Banana");
    }

    let base64Image;
    if (isNanoBanana) {
      // Ищем картинку в кандидатах ответа Gemini
      const candidate = data.candidates?.[0];
      const imagePart = candidate?.content?.parts?.find((part: any) => part.inlineData);
      
      if (!imagePart) {
        throw new Error("Модель не вернула изображение. Проверьте промпт на безопасность.");
      }
      
      base64Image = imagePart.inlineData.data;
    } else {
      // Логика для Imagen остается прежней
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