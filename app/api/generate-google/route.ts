import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt, aspectRatio, modelId } = await req.json();
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) return NextResponse.json({ error: "No API Key" }, { status: 500 });

    // 1. Определяем метод вызова на основе твоего списка моделей
    // Модели Imagen используют predict, Nano Banana - generateContent
    const isNanoBanana = modelId.includes("nano-banana");
    const method = isNanoBanana ? "generateContent" : "predict";
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:${method}?key=${apiKey}`;

    // 2. Формируем тело запроса в зависимости от метода
    let body;
    if (isNanoBanana) {
      // Структура для Nano Banana Pro (Gemini 3 Pro Image)
      body = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          aspectRatio: aspectRatio || "1:1"
        }
      };
    } else {
      // Структура для Imagen 4 (Ultra и Fast)
      body = {
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: aspectRatio || "1:1",
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
    if (!response.ok) throw new Error(data.error?.message || "Google API Error");

    // 3. Получаем изображение (пути в JSON для разных методов могут отличаться)
    let base64Image;
    if (isNanoBanana) {
      base64Image = data.candidates[0].content.parts[0].inlineData.data;
    } else {
      base64Image = data.predictions[0].bytesBase64Encoded;
    }

    return NextResponse.json({ imageUrl: `data:image/jpeg;base64,${base64Image}` });

  } catch (error: any) {
    console.error("Server Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}