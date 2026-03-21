import { NextResponse } from "next/server";
import { Bot, Keyboard } from '@maxhub/max-bot-api';
import { supabaseAdmin } from "@/app/lib/supabase-admin";

// Берем токен из переменных окружения, как ты и настроил
const MAX_TOKEN = process.env.BOT_TOKEN!;

if (!MAX_TOKEN) {
  console.error("ОШИБКА: Не задан BOT_TOKEN в .env!");
}

const bot = new Bot(MAX_TOKEN);

const MODELS = {
  NANO2: "🍌 Nano Banano 2 (Gemini 3.1 Flash) — 5 🍌",
  PRO: "🍌 Nano Banana Pro (Gemini 3 Pro) — 10 🍌",
  PRO4K: "🔥 Nano Banano Pro (4K) — 15 🍌"
};

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

// ==================== ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ====================
function getUserId(ctx: any): string | null {
  return ctx.message?.sender?.user_id?.toString() || 
         ctx.update?.message_callback?.sender?.user_id?.toString() || 
         ctx.update?.message?.sender?.user_id?.toString() ||
         null;
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
  const maxUserId = getUserId(ctx);
  
  if (maxUserId) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('balance')
      .eq('max_user_id', maxUserId)
      .maybeSingle();

    if (profile) {
      await ctx.reply(`💰 *Ваш баланс:* ${profile.balance} 🍌\n\nФункция пополнения через MAX в разработке!`, { format: 'markdown' });
      return;
    }
  }
  await ctx.reply("💰 Баланс: Не удалось найти профиль.");
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
  const maxUserId = getUserId(ctx);
  console.log("Нажали Создать картинку. ID:", maxUserId);

  // Если нашли пользователя, переводим его в режим выбора модели
  if (maxUserId) {
    await supabaseAdmin
      .from("profiles")
      .update({ bot_state: "choosing_model", bot_reference_url: null })
      .eq("max_user_id", maxUserId);
  } else {
    // Временно выводим в логи структуру ответа MAX, если ID снова не нашелся
    console.log("MAX CALLBACK STRUCTURE:", JSON.stringify(ctx.update, null, 2));
  }

  // Создаем клавиатуру (она теперь выведется в любом случае!)
  const buttons = [
    [Keyboard.button.callback(MODELS.NANO2, "model_nano2")],
    [Keyboard.button.callback(MODELS.PRO, "model_pro")],
    [Keyboard.button.callback(MODELS.PRO4K, "model_pro4k")],
    [Keyboard.button.callback("⬅️ Назад", "action_back")]
  ];

  const keyboard = Keyboard.inlineKeyboard(buttons);

  await ctx.reply("Выберите модель:", {
    attachments: [keyboard]
  });
});

// ==================== КНОПКА "НАЗАД" ====================
bot.action('action_back', async (ctx: any) => {
  const maxUserId = getUserId(ctx);
  
  if (maxUserId) {
    // Сбрасываем все состояния в базе
    await supabaseAdmin
      .from("profiles")
      .update({ bot_state: "idle", bot_selected_model: null, bot_reference_url: null })
      .eq("max_user_id", maxUserId);
  }
  
  // Возвращаем главное меню
  await sendMaxMainMenu(ctx, false);
});

// ==================== ВЫБОР МОДЕЛИ -> ПЕРЕХОД К ФОРМАТУ ====================
// Универсальная функция, чтобы не писать один и тот же код три раза
async function handleModelSelection(ctx: any, modelKey: keyof typeof MODELS) {
  const maxUserId = getUserId(ctx);
  if (!maxUserId) return;

  const modelDisplayName = MODELS[modelKey];

  // 1. Сохраняем выбранную модель в базу и переходим на шаг "choosing_format"
  await supabaseAdmin
    .from("profiles")
    .update({
      bot_state: "choosing_format",
      bot_selected_model: modelDisplayName
    })
    .eq("max_user_id", maxUserId);

  // 2. Рисуем клавиатуру с форматами
  const buttons = [
    [Keyboard.button.callback("⬛ 1:1 (Квадрат)", "format_1:1")],
    [
      Keyboard.button.callback("📱 9:16 (Верт.)", "format_9:16"),
      Keyboard.button.callback("🖥 16:9 (Гориз.)", "format_16:9")
    ],
    [Keyboard.button.callback("⬅️ Назад", "action_back")]
  ];

  const keyboard = Keyboard.inlineKeyboard(buttons);

  await ctx.reply(`Модель: *${modelDisplayName}*\n\nВыберите нужный формат изображения:`, {
    format: 'markdown', // Включаем поддержку жирного текста
    attachments: [keyboard]
  });
}

// Слушаем нажатия на кнопки моделей и передаем их в функцию
bot.action('model_nano2', (ctx: any) => handleModelSelection(ctx, 'NANO2'));
bot.action('model_pro', (ctx: any) => handleModelSelection(ctx, 'PRO'));
bot.action('model_pro4k', (ctx: any) => handleModelSelection(ctx, 'PRO4K'));

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