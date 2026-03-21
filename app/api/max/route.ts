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

// Новый обработчик /start с upsert для токена
bot.command('start', async (ctx: any) => {
  const maxUserId = ctx.user?.user_id;

  if (!maxUserId) return;

  // 🔥 создаём login_token (тот же, что и в Telegram)
  const loginToken = crypto.randomUUID();

  // 🔥 сохраняем в БД
  await supabase
    .from("profiles")
    .upsert({
      max_user_id: maxUserId,
      login_token: loginToken,
      login_token_expires: new Date(Date.now() + 5 * 60 * 1000),
    }, {
      onConflict: "max_user_id"
    });

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
                url: link
              }
            ]
          ]
        }
      ]
    }
  );
});

// Обновлённый обработчик сообщений с интеграцией Supabase
bot.on('message_created', async (ctx: any) => {
  const text = ctx.message?.body?.text;
  const maxUserId = ctx.user?.user_id;
  const username = ctx.user?.username || `max_${maxUserId}`;

  if (!maxUserId) return;

  // 1. ищем пользователя в таблице profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("max_user_id", maxUserId)
    .maybeSingle();

  let userProfile = profile;

  // 2. если нет — создаём нового пользователя и профиль
  if (!userProfile) {
    console.log("Создаём нового MAX пользователя:", maxUserId);

    const email = `max_${maxUserId}@max.local`;

    // создаём пользователя в auth
    const { data: authUser, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
      });

    if (authError) {
      console.error("AUTH ERROR:", authError);
      return;
    }

    // создаём профиль
    const { data: newProfile, error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: authUser.user.id,
        max_user_id: maxUserId,
        telegram_id: null,
        telegram_username: null,
        balance: 50,
      })
      .select()
      .single();

    if (profileError) {
      console.error("PROFILE ERROR:", profileError);
      return;
    }

    userProfile = newProfile;
  }

  // 3. логика бота: отвечаем с балансом
  if (text && text !== '/start') {
    await ctx.reply(`Ты написал: ${text}\n\n💰 Баланс: ${userProfile.balance} 🍌`);
  }
});

export async function POST(req: Request) {
  try {
    const update = await req.json();
    console.log("MAX ВХОДЯЩИЙ ВЕБХУК:", update?.message?.body?.text);

    // Обходим TypeScript защиту, чтобы вызвать handleUpdate
    await (bot as any).handleUpdate(update);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("MAX ERROR ВНУТРИ NEXT.JS:", e);
    return NextResponse.json({ ok: false });
  }
}