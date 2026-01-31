import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "No API Key" }, { status: 500 });
    }

    // Ищем модель "Gemini 2.0 Flash (Image Generation) Experimental" из твоего списка.
    // Она бесплатная и экспериментальная, биллинг для неё обычно не нужен.
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        // УБРАЛИ generationConfig, который вызывал ошибку
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google API Error:", errorText);
      throw new Error(`Google API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Ищем картинку. В экспериментальных моделях она лежит в inlineData
    const part = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    
    if (!part || !part.inlineData || !part.inlineData.data) {
       console.error("Full Google Response:", JSON.stringify(data, null, 2));
       throw new Error("Gemini returned no image. Model might have refused the prompt.");
    }

    const base64Image = part.inlineData.data;
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