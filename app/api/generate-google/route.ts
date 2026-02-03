import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // 1. Получаем prompt и aspectRatio с фронтенда
    const { prompt, aspectRatio } = await req.json();
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "No API Key" }, { status: 500 });
    }

    // 2. Используем актуальную модель Imagen 3
    const modelName = "imagen-3.0-generate-001";
    
    // URL для генерации через API ключ (Generative Language API)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:predict?key=${apiKey}`;

    // 3. Формируем тело запроса
    const body = {
      instances: [
        {
          prompt: prompt,
        },
      ],
      parameters: {
        sampleCount: 1,
        // Передаем выбранное соотношение сторон (или 1:1 по умолчанию)
        // Imagen поддерживает: "1:1", "16:9", "9:16", "3:4", "4:3"
        aspectRatio: aspectRatio === "auto" ? "1:1" : aspectRatio,
        outputOptions: {
           mimeType: "image/jpeg",
           // compressionQuality: 80 // Можно раскомментировать, если упретесь в лимиты Vercel
        }
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google API Error:", errorText);
      // Часто ошибка бывает из-за Safety Filters (цензуры)
      return NextResponse.json({ error: `Google API Error: ${errorText}` }, { status: response.status });
    }

    const data = await response.json();

    // 4. Достаем картинку
    const predictions = data.predictions;
    
    if (!predictions || predictions.length === 0) {
       throw new Error("No image generated.");
    }

    const base64Image = predictions[0].bytesBase64Encoded;
    const mimeType = predictions[0].mimeType || "image/jpeg";
    const imageUrl = `data:${mimeType};base64,${base64Image}`;

    return NextResponse.json({
      imageUrl: imageUrl,
    });

  } catch (error: any) {
    console.error("Server Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate" },
      { status: 500 }
    );
  }
}