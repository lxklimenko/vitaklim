import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const data = await req.json();

    console.log("MAX UPDATE:", data);

    const chatId = data.message?.recipient?.chat_id;

    if (!chatId) {
      return NextResponse.json({ ok: true });
    }

    const userText = data.message?.body?.text || "";

    // 👉 ответ
    await fetch("https://platform-api.max.ru/messages", {
      method: "POST",
      headers: {
        "Authorization": "f9LHodD0cOLMc8UCrC62G1ec2CypSZR1hYdu5-DRyPm3Er_LKh5BjR-6NnnWiQqkDeviNqkKrxBsDsa-SK4V",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: userText === "/start"
          ? "Hello! Welcome 🚀"
          : `You wrote: ${userText}`
      })
    });

    return NextResponse.json({ ok: true });

  } catch (e) {
    console.error("MAX ERROR:", e);
    return NextResponse.json({ ok: false });
  }
}