import { NextResponse } from "next/server";
import { Bot, Keyboard } from '@maxhub/max-bot-api';
import { supabaseAdmin } from "@/app/lib/supabase-admin";

const bot = new Bot("f9LHodD0cOLMc8UCrC62G1ec2CypSZR1hYdu5-DRyPm3Er_LKh5BjR-6NnnWiQqkDeviNqkKrxBsDsa-SK4V");

// ==================== ВЫВОД МЕНЮ ====================
async function sendMaxMainMenu(ctx: any, isAdmin: boolean = false) {
  // Используем callback-кнопки: первый аргумент — текст на кнопке, второй — скрытый сигнал (payload)
  const buttons = [
    [
      Keyboard.button.callback("🎨 Создать картинку", "action_create_image"),
      Keyboard.button.callback("🖼 Сгрен. по фото", "action_create_photo") // Немного сократил текст для ровности
    ],
    [
      Keyboard.button.callback("💰 Баланс", "action_balance"),
      Keyboard.button.callback("📜 История", "action_history")
    ],
    [
      Keyboard.button.callback("⚙️ Настройки", "action_settings"),
      Keyboard.button.callback("❓ Помощь", "action_help")
    ]
  ];

  if (isAdmin) {
    buttons.push([Keyboard.button.callback("🔐 Админ-панель", "action_admin")]);
  }

  const keyboard = Keyboard.inlineKeyboard(buttons);

  await ctx.reply("Выберите действие:", {
    attachments: [keyboard]
  });
}

// ==================== КОМАНДА /START ====================
bot.command('start', async (ctx: any) => {
  const senderName = ctx.message?.sender?.first_name || 'друг';
  const maxUserId = ctx.message?.sender?.user_id?.toString();

  if (!maxUserId) return;

  console.log(`MAX /start от: ${senderName}, ID: ${maxUserId}`);

  let { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('max_user_id', maxUserId)
    .maybeSingle();

  if (!profile) {
    console.log("Создаем нового пользователя MAX...");
    const email = `max_${maxUserId}@klex.pro`;
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
    });

    if (!authError) {
      const { data: newProfile } = await supabaseAdmin
        .from("profiles")
        .upsert({
          id: authUser.user.id,
          max_user_id: maxUserId,
          telegram_first_name: senderName,
          balance: 50,
          bot_state: "idle",
        })
        .select()
        .single();
      
      profile = newProfile;
      await ctx.reply(`Привет, ${senderName}! ✨ ИИ-бот KLEX.PRO дарит тебе 50 🍌 для старта!`);
    }
  } else {
    await ctx.reply(`С возвращением, ${senderName}! ✨`);
  }

  if (profile) {
    await supabaseAdmin
      .from("profiles")
      .update({ bot_state: "idle", bot_selected_model: null, bot_reference_url: null })
      .eq("id", profile.id);
  }

  await sendMaxMainMenu(ctx, false);
});

// ==================== ОБРАБОТКА НАЖАТИЙ НА КНОПКИ (ACTIONS) ====================

bot.action('action_balance', async (ctx: any) => {
  await ctx.reply("💰 *Ваш баланс:* (Функция проверки баланса подключается...)", { format: 'markdown' });
});

bot.action('action_history', async (ctx: any) => {
  await ctx.reply("📂 *Ваша история генераций*\n\n(Ссылка генерируется...)", { format: 'markdown' });
});

bot.action('action_help', async (ctx: any) => {
  const helpText = 
    `🚀 *Шпаргалка по KLEX.PRO*\n\n` +
    `• *🎨 Создать картинку* — генерация по тексту.\n` +
    `• *🖼 Сгенерировать по фото* — изменение фото.\n` +
    `• *💰 Баланс* — пополнение счета.\n`;
  await ctx.reply(helpText, { format: 'markdown' });
});

bot.action('action_settings', async (ctx: any) => {
  await ctx.reply("⚙️ *Настройки*\n\nСкоро здесь можно будет выбрать модель по умолчанию.", { format: 'markdown' });
});

bot.action('action_create_image', async (ctx: any) => {
  await ctx.reply("Функция генерации картинок скоро будет перенесена сюда! 🎨🚀");
});

bot.action('action_create_photo', async (ctx: any) => {
  await ctx.reply("Функция генерации по фото скоро будет перенесена сюда! 🖼🚀");
});

// ==================== ОБРАБОТКА ТЕКСТА ====================
// Если юзер что-то напишет руками, а не нажмет кнопку
bot.on('message_created', async (ctx: any) => {
  const text = ctx.message?.body?.text;
  if (!text || text.startsWith('/start')) return;
  
  await ctx.reply(`Я пока понимаю только нажатия на кнопки меню. Вызови /start, чтобы открыть меню!`);
});

// ==================== NEXT.JS ВЕБХУК ====================
export async function POST(req: Request) {
  try {
    const update = await req.json();
    await (bot as any).handleUpdate(update);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("MAX ERROR ВНУТРИ NEXT.JS:", e);
    return NextResponse.json({ ok: false });
  }
}