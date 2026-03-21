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

// ==================== ФУНКЦИИ ОТРИСОВКИ ШАГОВ (МАШИНА СОСТОЯНИЙ) ====================

// Шаг 1: Выбор модели
async function sendModelSelection(ctx: any, maxUserId: string) {
  await supabaseAdmin
    .from("profiles")
    .update({ bot_state: "choosing_model", bot_reference_url: null })
    .eq("max_user_id", maxUserId);

  const buttons = [
    [Keyboard.button.callback(MODELS.NANO2, "model_nano2")],
    [Keyboard.button.callback(MODELS.PRO, "model_pro")],
    [Keyboard.button.callback(MODELS.PRO4K, "model_pro4k")],
    [Keyboard.button.callback("⬅️ Назад", "action_back")]
  ];

  await ctx.reply("Выберите модель:", {
    attachments: [Keyboard.inlineKeyboard(buttons)]
  });
}

// Шаг 2: Выбор формата
async function sendFormatSelection(ctx: any, maxUserId: string, modelDisplayName: string) {
  // Сохраняем имя выбранной модели и меняем статус
  await supabaseAdmin
    .from("profiles")
    .update({
      bot_state: "choosing_format",
      bot_selected_model: modelDisplayName 
    })
    .eq("max_user_id", maxUserId);

  const buttons = [
    [Keyboard.button.callback("⬛ 1:1 (Квадрат)", "format_1:1")],
    [
      Keyboard.button.callback("📱 9:16 (Верт.)", "format_9:16"),
      Keyboard.button.callback("🖥 16:9 (Гориз.)", "format_16:9")
    ],
    [Keyboard.button.callback("⬅️ Назад", "action_back")]
  ];

  await ctx.reply(`Модель: *${modelDisplayName}*\n\nВыберите нужный формат изображения:`, {
    format: 'markdown',
    attachments: [Keyboard.inlineKeyboard(buttons)]
  });
}

// Шаг 3: Запрос промпта (текста)
async function handleFormatSelection(ctx: any, selectedFormat: string) {
  const maxUserId = getUserId(ctx);
  if (!maxUserId) return;

  // Достаем сохраненную модель из базы
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('bot_selected_model')
    .eq('max_user_id', maxUserId)
    .maybeSingle();

  const oldModelName = profile?.bot_selected_model || MODELS.NANO2;
  const newModelStr = `${oldModelName}|${selectedFormat}`; // Склеиваем модель и формат

  // Переходим в режим ожидания текста
  await supabaseAdmin
    .from("profiles")
    .update({ bot_state: "awaiting_prompt", bot_selected_model: newModelStr })
    .eq("max_user_id", maxUserId);

  const keyboard = Keyboard.inlineKeyboard([
    [Keyboard.button.callback("⬅️ Назад", "action_back")]
  ]);

  await ctx.reply(`✅ Формат *${selectedFormat}* выбран!\n\nНапишите, что нужно создать ✍️`, {
    format: 'markdown',
    attachments: [keyboard]
  });
}

// ==================== УМНАЯ КНОПКА "НАЗАД" ====================
bot.action('action_back', async (ctx: any) => {
  const maxUserId = getUserId(ctx);
  if (!maxUserId) return;

  // Смотрим, на каком шаге мы сейчас находимся в базе
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("bot_state, bot_selected_model")
    .eq("max_user_id", maxUserId)
    .maybeSingle();

  const currentState = profile?.bot_state || "idle";
  console.log(`🔘 Кнопка НАЗАД. Текущий шаг в базе: ${currentState}`);

  switch (currentState) {
    case "awaiting_prompt": {
      // ШАГ 3 -> Возвращаемся на ШАГ 2 (Выбор формата)
      const savedModelStr = profile?.bot_selected_model || "";
      const [modelName] = savedModelStr.split('|'); // Вытаскиваем только имя модели
      await sendFormatSelection(ctx, maxUserId, modelName || MODELS.NANO2);
      break;
    }
    case "choosing_format":
    case "choosing_photo_format": {
      // ШАГ 2 -> Возвращаемся на ШАГ 1 (Выбор модели)
      await sendModelSelection(ctx, maxUserId);
      break;
    }
    case "choosing_model":
    case "choosing_photo_model":
    default: {
      // ШАГ 1 -> Сбрасываем всё и выходим в Главное меню
      await supabaseAdmin
        .from("profiles")
        .update({ bot_state: "idle", bot_selected_model: null, bot_reference_url: null })
        .eq("max_user_id", maxUserId);
      await sendMaxMainMenu(ctx, false);
      break;
    }
  }
});

// ==================== ПРИВЯЗКА КНОПОК ====================

// Клик по "Создать картинку" в главном меню
bot.action('action_create_image', async (ctx: any) => {
  const maxUserId = getUserId(ctx);
  if (maxUserId) await sendModelSelection(ctx, maxUserId);
});

// Клик по моделям (с проверкой на null, чтобы TypeScript не ругался)
bot.action('model_nano2', async (ctx: any) => {
  const maxUserId = getUserId(ctx);
  if (maxUserId) await sendFormatSelection(ctx, maxUserId, MODELS.NANO2);
});

bot.action('model_pro', async (ctx: any) => {
  const maxUserId = getUserId(ctx);
  if (maxUserId) await sendFormatSelection(ctx, maxUserId, MODELS.PRO);
});

bot.action('model_pro4k', async (ctx: any) => {
  const maxUserId = getUserId(ctx);
  if (maxUserId) await sendFormatSelection(ctx, maxUserId, MODELS.PRO4K);
});

// Клик по форматам (безопасные асинхронные вызовы)
bot.action('format_1:1', async (ctx: any) => {
  const maxUserId = getUserId(ctx);
  if (maxUserId) await handleFormatSelection(ctx, '1:1');
});

bot.action('format_9:16', async (ctx: any) => {
  const maxUserId = getUserId(ctx);
  if (maxUserId) await handleFormatSelection(ctx, '9:16');
});

bot.action('format_16:9', async (ctx: any) => {
  const maxUserId = getUserId(ctx);
  if (maxUserId) await handleFormatSelection(ctx, '16:9');
});

// ==================== ГЕНЕРАЦИЯ ПО ФОТО (заглушка) ====================
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