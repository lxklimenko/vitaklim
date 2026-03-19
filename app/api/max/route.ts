import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    console.log("MAX UPDATE:", JSON.stringify(data, null, 2));

    const chatId = data.message?.recipient?.chat_id;
    const chatType = data.message?.recipient?.chat_type || "dialog";
    const senderUserId = data.message?.sender?.user_id;
    const userText = data.message?.body?.text || "";

    if (!chatId || !senderUserId) {
      return NextResponse.json({ ok: true });
    }

    // Собираем идеального получателя
    const payload = {
      recipient: {
        chat_id: chatId,
        chat_type: chatType,
        user_id: senderUserId
      },
      text: userText === "/start"
        ? "Победа! Бот MAX ответил! 🚀🍌"
        : `Вы написали: ${userText}`
    };

    console.log("SENDING TO MAX:", JSON.stringify(payload, null, 2));

    const res = await fetch("https://platform-api.max.ru/messages", {
      method: "POST",
      headers: {
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