import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const data = await req.json();

  console.log("MAX UPDATE:", data);

  const text = data?.message?.text || "";
  const userId = data?.message?.from?.id;

  if (!userId) {
    return NextResponse.json({ ok: true });
  }

  if (text.startsWith("/start")) {
    return NextResponse.json({
      method: "sendMessage",
      params: {
        user_id: userId,
        text: "🚀 Добро пожаловать в KLEX AI!\nНапиши промпт для генерации"
      }
    });
  }

  return NextResponse.json({
    method: "sendMessage",
    params: {
      user_id: userId,
      text: "Я получил сообщение: " + text
    }
  });
}