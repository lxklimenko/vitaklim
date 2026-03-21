import { NextResponse } from "next/server";
import { Bot } from '@maxhub/max-bot-api';
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Инициализируем Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Инициализируем бота
const bot = new Bot(process.env.MAX_BOT_TOKEN!);

/**
 * Создаёт (при необходимости) пользователя в auth и профиль в таблице profiles
 * @param maxUserId - идентификатор пользователя в Max
 * @returns объект профиля (с id, max_user_id и другими полями)
 */
async function ensureProfile(maxUserId: number) {
  // 1. Проверяем, существует ли уже профиль
  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("max_user_id", maxUserId)
    .maybeSingle();

  if (existing) return existing;

  console.log("Создаём нового пользователя Max:", maxUserId);

  const email = `max_${maxUserId}@max.local`;
  let userId: string;

  // 🔍 сначала проверяем — есть ли уже пользователь
  const { data: existingUsers } = await supabase.auth.admin.listUsers();

  const existingUser = existingUsers.users.find(
    (u) => u.email === email
  );

  if (existingUser) {
    console.log("Пользователь уже существует:", email);
    userId = existingUser.id;
  } else {
    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
      });

    if (authError || !authUser?.user) {
      console.error("Ошибка создания пользователя в auth:", authError);
      throw new Error(`Auth create failed: ${authError?.message || 'unknown'}`);
    }

    userId = authUser.user.id;
  }

  // Создаём профиль
  const { data: newProfile, error: profileError } = await supabase
    .from("profiles")
    .insert({
      id: userId,
      max_user_id: maxUserId,
      telegram_id: null,
      telegram_username: null,
      balance: 50,
    })
    .select()
    .single();

  if (profileError) {
    console.error("Ошибка создания профиля:", profileError);
    throw new Error(`Profile create failed: ${profileError.message}`);
  }

  return newProfile;
}

// Обработчик команды /start
bot.command('start', async (ctx: any) => {
  const maxUserId = ctx.user?.user_id;
  if (!maxUserId) return;

  try {
    // Гарантируем существование профиля
    await ensureProfile(maxUserId);

    // Генерируем токен для авторизации
    const loginToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 минут

    // Обновляем токен в профиле
    const { error } = await supabase
      .from("profiles")
      .update({
        login_token: loginToken,
        login_token_expires: expiresAt,
      })
      .eq("max_user_id", maxUserId);

    if (error) throw error;

    const link = `https://vitaklim-git-main-lxklimenkos-projects.vercel.app/auth?token=${loginToken}`;

    await ctx.reply(
      "🔐 Войди, чтобы синхронизировать аккаунт 👇",
      {
        attachments: [
          {
            type: "inline_keyboard",
            buttons: [
              [
                {
                  type: "link",
                  text: "🔗 Войти",
                  url: link,
                },
              ],
            ],
          },
        ],
      }
    );
  } catch (err) {
    console.error("Ошибка в /start:", err);
    await ctx.reply("⚠️ Произошла ошибка. Попробуй позже.");
  }
});

// Обработчик обычных сообщений
bot.on('message_created', async (ctx: any) => {
  const text = ctx.message?.body?.text;
  const maxUserId = ctx.user?.user_id;

  if (!maxUserId) return;

  // Игнорируем команду /start здесь, чтобы не дублировать ответ
  if (text === '/start') return;

  try {
    const userProfile = await ensureProfile(maxUserId);

    // Отвечаем с балансом
    await ctx.reply(
      `Ты написал: ${text}\n\n💰 Баланс: ${userProfile.balance} 🍌`
    );
  } catch (err) {
    console.error("Ошибка в обработчике сообщений:", err);
    await ctx.reply("⚠️ Не удалось обработать сообщение. Попробуй позже.");
  }
});

// Вебхук для приёма обновлений от Max
export async function POST(req: Request) {
  try {
    const update = await req.json();
    console.log("MAX ВХОДЯЩИЙ ВЕБХУК:", update?.message?.body?.text);

    // Передаём обновление боту
    await (bot as any).handleUpdate(update);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("MAX ERROR ВНУТРИ NEXT.JS:", e);
    return NextResponse.json({ ok: false });
  }
}