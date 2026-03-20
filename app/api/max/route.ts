import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("MAX UPDATE:", body);

    // ✅ правильный путь к данным из MAX
    const text = body.message?.body?.text;
    const chatId = body.message?.recipient?.chat_id;

    if (!chatId) {
      return NextResponse.json({});
    }

    return NextResponse.json({
      messages: [
        {
          chat_id: chatId,
          text: `Ты написал: ${text}`
        }
      ]
    });

  } catch (error) {
    console.error("MAX ERROR:", error);
    return NextResponse.json({});
  }
}