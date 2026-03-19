import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    console.log("MAX UPDATE:", JSON.stringify(data, null, 2));

    const chatId = data.message?.recipient?.chat_id;
    const userText = data.message?.body?.text || "";

    if (!chatId) {
      return NextResponse.json({ ok: true });
    }

    // Собираем правильную структуру: текст ДОЛЖЕН быть внутри body
    const payload = {
      recipient: {
        chat_id: chatId
      },
      body: {
        text: userText === "/start"
          ? "Бинго! Структура JSON разгадана! 🚀🍌"
          : `Вы написали: ${userText}`
      }
    };

    console.log("SENDING TO MAX:", JSON.stringify(payload, null, 2));

    const res = await fetch("https://platform-api.max.ru/messages", {
      method: "POST",
      headers: {
        // Если вдруг сервер начнет выдавать 401 Unauthorized, 
        // попробуй добавить "Bearer " перед токеном
        "Authorization": "f9LHodD0cOLMc8UCrC62G1ec2CypSZR1hYdu5-DRyPm3Er_LKh5BjR-6NnnWiQqkDeviNqkKrxBsDsa-SK4V",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const responseText = await res.text();
    console.log("MAX RESPONSE STATUS:", res.status);
    console.log("MAX RESPONSE BODY:", responseText);

    return NextResponse.json({ ok: true });

  } catch (e) {
    console.error("MAX ERROR:", e);
    return NextResponse.json({ ok: false });
  }
}