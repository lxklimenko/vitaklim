import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

      return NextResponse.json({
        messages: [
          {
            text: "✅ Аккаунт успешно подключен!"
          }
        ]
      })
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
    return NextResponse.json({
      messages: [
        {
          text: "❌ Аккаунт не найден. Зайдите через Telegram."
        }
      ]
    })
  }

  // =====================
  // 💰 БАЛАНС
  // =====================
  if (text === "💰 Баланс") {
    return NextResponse.json({
      messages: [
        {
          text: `💰 Баланс: ${profile.balance} 🍌`
        }
      ]
    })
  }

  // =====================
  // 🎨 СОЗДАТЬ КАРТИНКУ
  // =====================
  if (text === "🎨 Создать картинку") {
    await supabase
      .from("profiles")
      .update({ bot_state: "awaiting_prompt" })
      .eq("id", profile.id)

    return NextResponse.json({
      messages: [
        {
          text: "✍️ Напиши описание картинки"
        }
      ]
    })
  }

  // =====================
  // ✍️ ГЕНЕРАЦИЯ
  // =====================
  if (profile.bot_state === "awaiting_prompt") {
    const prompt = text

    if (!prompt) {
      return NextResponse.json({
        messages: [
          {
            text: "❌ Напиши текст"
          }
        ]
      })
    }

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

      await supabase
        .from("profiles")
        .update({ bot_state: "idle" })
        .eq("id", profile.id)

      return NextResponse.json({
        messages: [
          {
            text: `✅ Готово:\n${result.imageUrl}`
          }
        ]
      })

    } catch (e) {
      return NextResponse.json({
        messages: [
          {
            text: "❌ Ошибка генерации"
          }
        ]
      })
    }
  }

  // =====================
  // 📜 ИСТОРИЯ
  // =====================
  if (text === "📜 История") {
    const url = `https://klex.pro/history?u=${profile.id}`
    return NextResponse.json({
      messages: [
        {
          text: `📂 История:\n${url}`
        }
      ]
    })
  }

  // =====================
  // ❓ ПОМОЩЬ
  // =====================
  if (text === "❓ Помощь") {
    return NextResponse.json({
      messages: [
        {
          text: "Используй команды:\n🎨 Создать картинку\n💰 Баланс"
        }
      ]
    })
  }

  return NextResponse.json({
    messages: [
      {
        text: "Неизвестная команда"
      }
    ]
  })
}