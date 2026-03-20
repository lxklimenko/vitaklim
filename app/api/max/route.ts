import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("MAX UPDATE:", body);

    const userId = body.user?.id;
    const text = body.message?.text;

    if (!text) {
      return NextResponse.json({
        messages: [{ text: "Напиши что-нибудь 👀" }]
      });
    }

    // простая логика
    if (text === "/start") {
      return NextResponse.json({
        messages: [
          { text: "🔥 Добро пожаловать в Max-бот!" },
          { text: "Напиши что угодно — я отвечу 😄" }
        ]
      });
    }

    // echo
    return NextResponse.json({
      messages: [
        { text: `Ты написал: ${text}` }
      ]
    });

  } catch (error) {
    console.error("MAX ERROR:", error);

    return NextResponse.json({
      messages: [{ text: "Ошибка 😢" }]
    });
  }
}