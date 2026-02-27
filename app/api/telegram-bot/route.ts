import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateImageCore } from "@/app/lib/generateCore";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log("SUPABASE URL:", SUPABASE_URL);
console.log("SERVICE ROLE EXISTS:", !!SUPABASE_SERVICE_ROLE_KEY);

async function sendMessage(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });
}

async function sendMainMenu(chatId: number) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "Выберите действие:",
      reply_markup: {
        keyboard: [
          [
            { text: "🎨 Сгенерировать" },
            { text: "🖼 По фото" }
          ],
          [
            { text: "💰 Баланс" },
            { text: "🚀 Открыть приложение" }
          ]
        ],
        resize_keyboard: true
      }
    })
  });
}

/**
 * Отправляет фото в Telegram, загружая его по URL и передавая как бинарные данные (multipart/form-data)
 */
async function sendPhotoBuffer(chatId: number, imageUrl: string) {
  // скачиваем файл с signed URL
  const imageResponse = await fetch(imageUrl);
  const buffer = await imageResponse.arrayBuffer();

  const formData = new FormData();
  formData.append("chat_id", chatId.toString());
  formData.append(
    "photo",
    new Blob([buffer], { type: "image/jpeg" }),
    "image.jpg"
  );

  const res = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
    {
      method: "POST",
      body: formData
    }
  );

  const data = await res.json();
  console.log("SEND PHOTO RESPONSE:", data);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("UPDATE:", body);

    const message = body.message;
    if (!message) return NextResponse.json({ ok: true });

    const chatId = message.chat.id;
    const telegramId = message.from.id;
    const username = message.from.username || `telegram_${telegramId}`;
    const text = message.text;

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (profileError) {
      console.error("PROFILE SELECT ERROR:", profileError);
    }

    let profile = profileData;

    if (!profile) {
      console.log("Creating new Telegram user...");

      const email = `telegram_${telegramId}@klex.pro`;
      let userId: string;

      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers.users.find((u) => u.email === email);

      if (existingUser) {
        userId = existingUser.id;
      } else {
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email,
          email_confirm: true,
        });

        if (authError) {
          console.error("AUTH CREATE ERROR:", authError);
          return NextResponse.json({ ok: true });
        }

        userId = authUser.user.id;
      }

      const { data: newProfile, error } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          telegram_id: telegramId,
          telegram_username: username,
          balance: 0,
        })
        .select()
        .single();

      if (error) {
        console.error("PROFILE INSERT ERROR:", error);
        return NextResponse.json({ ok: true });
      }

      profile = newProfile;
    }

    if (text === "/start") {
      await sendMessage(
        chatId,
        "Привет! ИИ-бот KLEX.PRO открывает вам доступ к лучшим нейросетям для создания изображений."
      );

      await sendMainMenu(chatId);

      return NextResponse.json({ ok: true });
    } else {
      if (profile.balance <= 0) {
        await sendMessage(
          chatId,
          "❌ Недостаточно средств.\n\nПополни баланс в Mini App."
        );
        return NextResponse.json({ ok: true });
      }

      await sendMessage(chatId, "🎨 Генерация запущена...");

      try {
        const result = await generateImageCore({
          userId: profile.id,
          prompt: text,
          modelId: "gemini-2.5-flash-image",
          aspectRatio: "1:1",
          supabase
        });

        console.log("SENDING PHOTO:", result.imageUrl);
        await sendPhotoBuffer(chatId, result.imageUrl);
        console.log("PHOTO SENT");

      } catch (error: any) {
        console.error("GENERATION ERROR:", error);

        await sendMessage(
          chatId,
          `❌ Ошибка генерации:\n${error.message}`
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("GLOBAL ERROR:", err);
    return NextResponse.json({ ok: true });
  }
}