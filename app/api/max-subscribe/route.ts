import { NextResponse } from "next/server"

export async function GET() {
  console.log("🔥 TRY SUBSCRIBE")

  // 👇 ВОТ СЮДА ДОБАВЬ
  console.log("TOKEN:", process.env.MAX_BOT_TOKEN_DEV)

  const res = await fetch("https://platform-api.max.ru/subscriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MAX_BOT_TOKEN_DEV}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: "https://vitaklim-git-dev-lxklimenkos-projects.vercel.app/api/max",
      update_types: ["message_created", "bot_started"],
    }),
  })

  const data = await res.json()

  console.log("🔥 MAX RESPONSE:", data)

  return NextResponse.json(data)
}