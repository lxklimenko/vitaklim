import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt, aspectRatio } = await req.json();
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "No API Key" }, { status: 500 });
    }

    // Используем модель из твоего скриншота Google AI Studio
    const modelName = "gemini-3-pro-image-generation";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:predict?key=${apiKey}`;

    const body = {
      instances: [
        {
          prompt: prompt,
        },
      ],
      parameters: {
        sampleCount: 1,
        // Соотношение сторон теперь передается динамически
        aspectRatio: aspectRatio === "auto" ? "1:1" : aspectRatio,
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
      throw new Error(`Google API error: ${response.status}`);
    }

    const data = await response.json();
    const predictions = data.predictions;
    
    if (!predictions || predictions.length === 0) {
       throw new Error("No image generated.");
    }

    const base64Image = predictions[0].bytesBase64Encoded;
    const imageUrl = `data:image/jpeg;base64,${base64Image}`;

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