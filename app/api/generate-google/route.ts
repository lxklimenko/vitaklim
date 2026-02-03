import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt, aspectRatio, modelId, image, imageMode } = await req.json();
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "No API Key" }, { status: 500 });
    }

    // Определяем метод на основе ID модели
    const isNanoBanana = modelId.includes("nano-banana") || modelId.includes("gemini-3");
    const method = isNanoBanana ? "generateContent" : "predict";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:${method}?key=${apiKey}`;

    let body;

    if (isNanoBanana) {
      // Логика для Nano Banana Pro (Gemini 3 Pro)
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
          // ПРАВИЛЬНАЯ СТРУКТУРА ДЛЯ GEMINI 3 / NANO BANANA PRO
          image_generation_config: {
            aspect_ratio: aspectRatio || "1:1"
          }
        }
      };
    } else {
      // Логика для Imagen 4
      const instance: any = { prompt };

      if (image) {
        // Чтобы фото учитывалось как референс:
        instance.image = {
          bytesBase64Encoded: image.split(',')[1]
        };
      }

      body = {
        instances: [instance],
        parameters: {
          sampleCount: 1,
          aspectRatio: aspectRatio || "1:1",
          outputOptions: { mimeType: "image/jpeg" },
          // ВАЖНО: Добавь эти параметры для Image-to-Image
          editConfig: image ? {
            editMode: "variation", // Создает вариацию на основе твоего фото
            guidanceScale: 60      // Насколько сильно следовать фото (0-100)
          } : undefined
        }
      };
    }

    console.log("Request body:", JSON.stringify(body, null, 2));

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error("Google API Error:", data);
      throw new Error(data.error?.message || data.error || "Google API Error");
    }

    let base64Image;
    if (isNanoBanana) {
      // Ищем часть с изображением в ответе Gemini
      const candidate = data.candidates?.[0];
      if (!candidate) {
        throw new Error("No candidates in response");
      }
      
      const imagePart = candidate.content?.parts?.find((part: any) => part.inlineData);
      if (!imagePart) {
        console.error("No image in Gemini response:", data);
        throw new Error("No image generated in response");
      }
      
      base64Image = imagePart.inlineData.data;
    } else {
      // Imagen 4 ответ
      if (!data.predictions?.[0]?.bytesBase64Encoded) {
        console.error("No image in Imagen response:", data);
        throw new Error("No image generated in response");
      }
      base64Image = data.predictions[0].bytesBase64Encoded;
    }

    return NextResponse.json({ 
      imageUrl: `data:image/jpeg;base64,${base64Image}` 
    });

  } catch (error: any) {
    console.error("Server Error:", error);
    return NextResponse.json({ 
      error: error.message || "Internal server error" 
    }, { status: 500 });
  }
}