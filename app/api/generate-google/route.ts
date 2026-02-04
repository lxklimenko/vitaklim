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
      // 1. ЛОГИКА ДЛЯ NANO BANANA PRO (Gemini 3 Pro)
      // Использует generateContent и поддерживает мультимодальность (текст + фото)
      const parts: any[] = [{ text: prompt }];
      
      if (image) {
        parts.push({
          inlineData: {
            mimeType: image.split(';')[0].split(':')[1],
            data: image.split(',')[1]
          }
        });
      }

      body = {
        contents: [{ parts }],
        generationConfig: {
          // ВАЖНО: Gemini требует snake_case (aspect_ratio)
          aspect_ratio: aspectRatio === "auto" ? "1:1" : aspectRatio
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
      console.error("Google API Error:", data);
      throw new Error(data.error?.message || "Ошибка Google API");
    }

    // Извлекаем результат в зависимости от метода
    const base64Image = isNanoBanana 
      ? data.candidates[0].content.parts[0].inlineData.data 
      : data.predictions[0].bytesBase64Encoded;

    return NextResponse.json({ 
      imageUrl: `data:image/jpeg;base64,${base64Image}` 
    });

  } catch (error: any) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}