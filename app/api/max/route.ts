import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    console.log("MAX UPDATE:", data);

    // Берем chat_id из объекта recipient входящего сообщения
    const chatId = data.message?.recipient?.chat_id;
    const userText = data.message?.body?.text || "";

    if (!chatId) {
      return NextResponse.json({ ok: true });
    }

    const res = await fetch("https://platform-api.max.ru/messages", {
      method: "POST",
      headers: {
        "Authorization": "f9LHodD0cOLMc8UCrC62G1ec2CypSZR1hYdu5-DRyPm3Er_LKh5BjR-6NnnWiQqkDeviNqkKrxBsDsa-SK4V",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        // Отправляем ТОЛЬКО chat_id, без user_id
        recipient: {
          chat_id: chatId
        },
        text: userText === "/start"
          ? "Привет! Бот на платформе MAX официально работает! 🚀"
          : `Вы написали: ${userText}`
      })
    });

    // Читаем ответ текстом, чтобы не падало, если сервер вернет не JSON
    const responseText = await res.text();
    console.log("MAX RESPONSE:", responseText);

    return NextResponse.json({ ok: true });

  } catch (e) {
    console.error("MAX ERROR:", e);
    return NextResponse.json({ ok: false });
  }
}