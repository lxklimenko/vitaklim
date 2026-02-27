import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

export async function POST(req: Request) {
  const body = await req.json();
  const message = body.message;

  if (!message) return NextResponse.json({ ok: true });

  const chatId = message.chat.id;
  const telegramId = message.from.id;
  const username = message.from.username || `telegram_${telegramId}`;
  const text = message.text;

  // 🔎 Проверяем есть ли пользователь
  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("telegram_id", telegramId)
    .single();

  // 👤 Если нет — создаём
  if (!profile) {
    // 1️⃣ Создаём пользователя в auth.users
    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email: `telegram_${telegramId}@klex.pro`,
        email_confirm: true,
      });

    if (authError) {
      console.error("AUTH CREATE ERROR:", authError);
      return NextResponse.json({ ok: true });
    }

    const userId = authUser.user.id;

    // 2️⃣ Создаём профиль с тем же id
    const { data: newProfile, error } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        telegram_id: telegramId,
        username,
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
      `Привет 👋\n\nТвой баланс: ${profile.balance}\n\nНапиши описание — и я сгенерирую изображение 🎨`
    );
  } else {
    await sendMessage(
      chatId,
      `Баланс: ${profile.balance}\n\nЗапрос получен:\n"${text}"\n\nГенерацию подключим следующим шагом 🚀`
    );
  }

  return NextResponse.json({ ok: true });
}