import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    console.log("MAX UPDATE:", data);

    // Берем ID того, КТО прислал сообщение (Sender)
    const senderUserId = data.message?.sender?.user_id;
    const userText = data.message?.body?.text || "";

    if (!senderUserId) {
      return NextResponse.json({ ok: true });
    }

    const res = await fetch("https://platform-api.max.ru/messages", {
      method: "POST",
      headers: {
        "Authorization": "f9LHodD0cOLMc8UCrC62G1ec2CypSZR1hYdu5-DRyPm3Er_LKh5BjR-6NnnWiQqkDeviNqkKrxBsDsa-SK4V",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        // В мессенджере Max для лички достаточно указать user_id отправителя
        recipient: {
          user_id: senderUserId 
        },
        text: userText === "/start"
          ? "Привет! Бот на платформе MAX работает 🚀"
          : `Вы написали: ${userText}`
      })
    });

    const responseData = await res.json();
    console.log("MAX RESPONSE:", responseData);

    return NextResponse.json({ ok: true });

  } catch (e) {
    console.error("MAX ERROR:", e);
    return NextResponse.json({ ok: false });
  }
}