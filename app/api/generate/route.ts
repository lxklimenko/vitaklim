import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // Используем dall-e-2, так как он быстрый (3-5 сек)
    const result = await openai.images.generate({
      model: "dall-e-2", 
      prompt,
      size: "512x512", // Можно 512x512 или 1024x1024
      n: 1,
    });

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