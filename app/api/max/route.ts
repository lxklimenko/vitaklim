import { NextResponse } from "next/server";

const MAX_TOKEN = process.env.MAX_BOT_TOKEN!;

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("MAX UPDATE:", body);

    // ✅ правильный разбор данных из MAX
    const text = body.message?.body?.text;
    const chatId = body.message?.recipient?.chat_id;

    if (!chatId) {
      console.log("❌ No chat_id");
      return NextResponse.json({});
    }

    // если нет текста (например, стикер или что-то другое)
    if (!text) {
      await sendMessage(chatId, "Напиши текст ✍️");
      return NextResponse.json({ ok: true });
    }

    // простая логика ответа
    await sendMessage(chatId, `Ты написал: ${text}`);

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error("MAX ERROR:", error);
    return NextResponse.json({});
  }
}

// 👇 функция отправки сообщения в MAX
async function sendMessage(chatId: number, text: string) {
  try {
    const res = await fetch("https://platform-api.max.ru/messages", {
      method: "POST",
      headers: {
        "Authorization": MAX_TOKEN, // 🔥 важно!
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    });

    const data = await res.text();

    console.log("MAX SEND RESPONSE:", res.status, data);

  } catch (error) {
    console.error("SEND MESSAGE ERROR:", error);
  }
}

// 👇 чтобы MAX мог проверять endpoint
export async function GET() {
  return NextResponse.json({ status: "ok" });
}