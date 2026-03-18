import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const data = await req.json();

  console.log("MAX UPDATE:", data);

  const chatId = data.chat_id;

  // 👉 Если пользователь нажал Start (через ссылку или просто)
  if (data.update_type === "bot_started") {
    await fetch("https://platform-api.max.ru/messages", {
      method: "POST",
      headers: {
        "Authorization": "ТВОЙ_ТОКЕН",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: "🚀 Добро пожаловать в KLEX AI!\nНапиши промпт для генерации"
      })
    });

    return NextResponse.json({ ok: true });
  }

  // 👉 Если пришло обычное сообщение
  if (data.update_type === "message_created") {
    const text = data.message?.text || "";

    await fetch("https://platform-api.max.ru/messages", {
  method: "POST",
  headers: {
    "Authorization": "ТВОЙ_ТОКЕН",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    chat_id: chatId,
    text: decodeURIComponent(encodeURIComponent("🚀 Добро пожаловать в KLEX AI!\nНапиши промпт"))
  })
});
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}