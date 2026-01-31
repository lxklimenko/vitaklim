import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "No API Key" }, { status: 500 });
    }

    // Используем модель Gemini 2.0 Flash Experimental (она же Nano Banana)
    // Она бесплатная и работает через AI Studio без сложного биллинга
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: "Generate an image: " + prompt } 
            ]
          }
        ],
        generationConfig: {
          // Gemini умеет отдавать картинки, если попросить
          responseMimeType: "image/jpeg" 
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google API Error:", errorText);
      throw new Error(`Google API error: ${response.status}`);
    }

    const data = await response.json();

    // Ищем картинку в ответе Gemini
    // Обычно она лежит здесь: candidates[0].content.parts[0].inlineData.data
    const part = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    
    if (!part || !part.inlineData || !part.inlineData.data) {
       console.error("No image data found:", JSON.stringify(data, null, 2));
       throw new Error("Gemini returned no image. Try a different prompt.");
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