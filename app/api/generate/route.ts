import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/app/lib/supabase-server";
import { syncProfile } from "@/app/lib/vps-sync";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    // 1. Проверяем авторизацию
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Необходимо войти в аккаунт" },
        { status: 401 }
      );
    }

    // 2. Проверяем баланс
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Профиль не найден" },
        { status: 404 }
      );
    }

    if (profile.balance < 1) {
      return NextResponse.json(
        { error: "Недостаточно баланса" },
        { status: 402 }
      );
    }

    // 3. Получаем промпт
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "Промпт не может быть пустым" },
        { status: 400 }
      );
    }

    // 4. Генерируем изображение
    const result = await openai.images.generate({
      model: "dall-e-2",
      prompt: prompt.trim(),
      size: "512x512",
      n: 1,
    });

    if (!result.data?.[0]?.url) {
      return NextResponse.json(
        { error: "OpenAI не вернул изображение" },
        { status: 500 }
      );
    }

    // 5. Списываем баланс
    await supabase
      .from("profiles")
      .update({ balance: profile.balance - 1 })
      .eq("id", user.id);
    await syncProfile(supabase, user.id);

    return NextResponse.json({
      imageUrl: result.data[0].url,
    });

  } catch (error) {
    console.error("Ошибка генерации:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
