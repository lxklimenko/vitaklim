import { NextResponse } from "next/server";

const MAX_TOKEN = process.env.MAX_BOT_TOKEN!;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("MAX UPDATE:", body);

    const text = body.message?.body?.text;
    const chatId = body.message?.recipient?.chat_id;

    if (!chatId) {
      return NextResponse.json({});
    }

    // ✅ отправка ответа через API MAX
    await fetch("https://platform-api.max.ru/messages", {
      method: "POST",
      headers: {
        "Authorization": MAX_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: `Ты написал: ${text}`,
      }),
    });

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error("MAX ERROR:", error);
    return NextResponse.json({});
  }
}