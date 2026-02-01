import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "No API Key" }, { status: 500 });
    }

    // --- НАСТРОЙКИ ---
    // Используем самую мощную модель из вашего списка
    const modelName = "imagen-4.0-ultra-generate-001";
    
    // ВАЖНО: Для картинок используем метод :predict, а не :generateContent
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:predict?key=${apiKey}`;

    // --- ТЕЛО ЗАПРОСА (JSON) ---
    // У Imagen структура отличается от Gemini.
    // Тут используются 'instances' (ваши запросы) и 'parameters' (настройки)
    const body = {
      instances: [
        {
          prompt: prompt,
        },
      ],
      parameters: {
        sampleCount: 1, // Количество картинок (обычно 1-4)
        aspectRatio: "1:1", // Пропорции: "1:1", "16:9", "3:4", "4:3"
        outputOptions: {
           mimeType: "image/jpeg"
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
      throw new Error(`Google API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // --- ПОЛУЧЕНИЕ КАРТИНКИ ---
    // Imagen возвращает массив 'predictions'. Внутри байты в base64.
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