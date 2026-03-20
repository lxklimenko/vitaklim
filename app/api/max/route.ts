import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function sendMessage(userId: string, text: string) {
  const res = await fetch("https://botapi.max.ru/message", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.MAX_BOT_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: userId,
      text: text
    })
  })

  const data = await res.json()
  console.log("MAX SEND RESPONSE:", data)
}

export async function POST(req: Request) {
  const body = await req.json()

  const text = body?.message?.body?.text
  const maxUserId = body?.message?.sender?.id

  if (!text || !maxUserId) {
    return NextResponse.json({ ok: true })
  }

  // =====================
  // 🔗 LINK ACCOUNT (/start TOKEN)
  // =====================
  const parts = text.split(' ')
  const token = parts[1]

  if (token) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("login_token", token)
      .single()

    if (profile) {
      await supabase
        .from("profiles")
        .update({
          max_id: maxUserId,
          login_token: null,
          login_token_expires: null
        })
        .eq("id", profile.id)

      await sendMessage(maxUserId, "✅ Аккаунт успешно подключен!")
    }

    return NextResponse.json({ ok: true })
  }

  // =====================
  // 👤 ИЩЕМ ПОЛЬЗОВАТЕЛЯ
  // =====================
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("max_id", maxUserId)
    .single()

  if (!profile) {
    await sendMessage(maxUserId, "❌ Аккаунт не найден. Зайдите через Telegram.")
    return NextResponse.json({ ok: true })
  }

  // =====================
  // 💰 БАЛАНС
  // =====================
  if (text === "💰 Баланс") {
    await sendMessage(maxUserId, `💰 Баланс: ${profile.balance} 🍌`)
    return NextResponse.json({ ok: true })
  }

  // =====================
  // 🎨 СОЗДАТЬ КАРТИНКУ
  // =====================
  if (text === "🎨 Создать картинку") {
    await supabase
      .from("profiles")
      .update({ bot_state: "awaiting_prompt" })
      .eq("id", profile.id)

    await sendMessage(maxUserId, "✍️ Напиши описание картинки")
    return NextResponse.json({ ok: true })
  }

  // =====================
  // ✍️ ГЕНЕРАЦИЯ
  // =====================
  if (profile.bot_state === "awaiting_prompt") {
    const prompt = text

    if (!prompt) {
      await sendMessage(maxUserId, "❌ Напиши текст")
      return NextResponse.json({ ok: true })
    }

    await sendMessage(maxUserId, "🎨 Генерация...")

    try {
      const { generateImageCore } = await import("@/app/lib/generateCore")

      const result = await generateImageCore({
        userId: profile.id,
        prompt,
        modelId: "gemini-3.1-flash-image-preview",
        aspectRatio: "1:1",
        supabase,
        imageBuffers: undefined
      })

      await sendMessage(maxUserId, `✅ Готово:\n${result.imageUrl}`)

      await supabase
        .from("profiles")
        .update({ bot_state: "idle" })
        .eq("id", profile.id)

    } catch (e) {
      await sendMessage(maxUserId, "❌ Ошибка генерации")
    }

    return NextResponse.json({ ok: true })
  }

  // =====================
  // 📜 ИСТОРИЯ
  // =====================
  if (text === "📜 История") {
    const url = `https://klex.pro/history?u=${profile.id}`
    await sendMessage(maxUserId, `📂 История:\n${url}`)
    return NextResponse.json({ ok: true })
  }

  // =====================
  // ❓ ПОМОЩЬ
  // =====================
  if (text === "❓ Помощь") {
    await sendMessage(maxUserId, "Используй команды:\n🎨 Создать картинку\n💰 Баланс")
    return NextResponse.json({ ok: true })
  }

  await sendMessage(maxUserId, "Неизвестная команда")
  return NextResponse.json({ ok: true })
}