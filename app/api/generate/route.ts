import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024"
    });

    return NextResponse.json({
      imageUrl: result.data?.[0]?.url
    });

  } catch (error: any) {
    console.error("OPENAI ERROR:", error);
    return NextResponse.json(
      { error: error.message || "OpenAI failed" },
      { status: 500 }
    );
  }
}
