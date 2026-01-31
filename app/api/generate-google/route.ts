import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GOOGLE_API_KEY is missing" },
        { status: 500 }
      );
    }

    // Используем модель Imagen 4 Fast (найдена в твоем списке)
    // Она быстрая и поддерживает метод predict
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [
          {
            prompt: prompt,
          },
        ],
        parameters: {
          sampleCount: 1,
          aspectRatio: "1:1", // Квадратная картинка
          // Можно добавить personGeneration: "allow_adult" если нужно разрешить людей,
          // но Google может блокировать это.
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google API Error:", errorText);
      throw new Error(`Google API error: ${response.statusText} (${response.status})`);
    }

    const data = await response.json();

    // Проверяем, есть ли картинка в ответе
    if (!data.predictions || !data.predictions[0] || !data.predictions[0].bytesBase64Encoded) {
      console.error("Google response data:", data);
      throw new Error("No image generated (Google returned empty predictions)");
    }

    // Google отдает картинку в кодировке Base64, превращаем её в ссылку для браузера
    const base64Image = data.predictions[0].bytesBase64Encoded;
    const imageUrl = `data:image/png;base64,${base64Image}`;

    return NextResponse.json({
      imageUrl: imageUrl,
    });

  } catch (error: any) {
    console.error("Google Generation Error:", error);
    return NextResponse.json(
      { error: error.message || "Google generation failed" },
      { status: 500 }
    );
  }
}