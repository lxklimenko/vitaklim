import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
    });

    // Жёсткая проверка
    if (!result.data || !result.data[0] || !result.data[0].url) {
      return NextResponse.json(
        { error: "OpenAI returned no image" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      imageUrl: result.data[0].url,
    });
  } catch (error: any) {
    console.error("OpenAI error:", error);
    return NextResponse.json(
      { error: error.message || "OpenAI error" },
      { status: 500 }
    );
  }
}
