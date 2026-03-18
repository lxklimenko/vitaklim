import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const data = await req.json();

    console.log("MAX UPDATE:", data);

    // 👉 правильный chat_id
    const chatId = data.message?.recipient?.chat_id;

    if (!chatId) {
      return NextResponse.json({ ok: true });
    }

    // 👉 текст пользователя
    const userText = data.message?.body?.text || "";

    // 👉 если /start
    if (userText === "/start" || data.update_type === "bot_started") {
      await fetch("https://platform-api.max.ru/messages", {
        method: "POST",
        headers: {
          "Authorization": process.env.MAX_BOT_TOKEN || "ТВОЙ_ТОКЕН",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Hello! Welcome to KLEX AI 🚀"
        })
      });

      return NextResponse.json({ ok: true });
    }

    // 👉 любое сообщение
    if (data.update_type === "message_created") {
      await fetch("https://platform-api.max.ru/messages", {
        method: "POST",
        headers: {
          "Authorization": process.env.MAX_BOT_TOKEN || "f9LHodD0cOLMc8UCrC62G1ec2CypSZR1hYdu5-DRyPm3Er_LKh5BjR-6NnnWiQqkDeviNqkKrxBsDsa-SK4V",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: `You wrote: ${userText}`
        })
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });

  } catch (e) {
    console.error("MAX ERROR:", e);
    return NextResponse.json({ ok: false });
  }
}