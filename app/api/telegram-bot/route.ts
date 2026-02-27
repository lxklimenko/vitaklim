import { NextResponse } from "next/server";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

async function sendMessage(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });
}

export async function POST(req: Request) {
  const body = await req.json();

  const message = body.message;

  if (!message) {
    return NextResponse.json({ ok: true });
  }

  const chatId = message.chat.id;
  const text = message.text;

  if (text === "/start") {
    await sendMessage(chatId, "Привет 👋 Я AI-бот Klex.Pro\n\nНапиши описание — и я сгенерирую изображение 🎨");
  } else {
    await sendMessage(chatId, `Ты написал:\n\n"${text}"\n\nСкоро я буду генерировать по этому запросу 🚀`);
  }

  return NextResponse.json({ ok: true });
}