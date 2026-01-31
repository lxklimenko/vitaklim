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

    // URL для модели Imagen 3 (она же Nano Banano для картинок)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`;

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
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google API Error:", errorText);
      throw new Error(`Google API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Google отдает картинку в кодировке Base64, нам нужно превратить её в ссылку
    if (!data.predictions || !data.predictions[0] || !data.predictions[0].bytesBase64Encoded) {
      throw new Error("No image generated");
    }

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