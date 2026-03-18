import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const data = await req.json();

    console.log("MAX UPDATE:", data);

    const userId = data.message?.sender?.user_id;
    const userText = data.message?.body?.text || "";

    if (!userId) {
      return NextResponse.json({ ok: true });
    }

    const res = await fetch("https://platform-api.max.ru/messages", {
      method: "POST",
      headers: {
        "Authorization": "f9LHodD0cOLMc8UCrC62G1ec2CypSZR1hYdu5-DRyPm3Er_LKh5BjR-6NnnWiQqkDeviNqkKrxBsDsa-SK4V",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        recipient: {
          user_id: userId
        },
        text: userText === "/start"
          ? "Hello! MAX bot works 🚀"
          : `You wrote: ${userText}`
      })
    });

    const responseText = await res.text();
    console.log("MAX RESPONSE:", responseText);

    return NextResponse.json({ ok: true });

  } catch (e) {
    console.error("MAX ERROR:", e);
    return NextResponse.json({ ok: false });
  }
}