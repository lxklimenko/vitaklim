import { NextResponse } from "next/server";
import { Bot, Keyboard } from '@maxhub/max-bot-api';
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { generateImageCore } from "@/app/lib/generateCore";
import fs from 'fs';
import path from 'path';
import os from 'os';

// ==================== КОНСТАНТЫ ====================
const MAX_TOKEN = process.env.MAX_BOT_TOKEN!; 
if (!MAX_TOKEN) {
    console.error("ОШИБКА: Переменная MAX_BOT_TOKEN не найдена! Проверь настройки Vercel.");
}

const bot = new Bot(MAX_TOKEN);

const MODELS = {
  NANO2: "🍌 Nano Banano 2 (Gemini 3.1 Flash) — 5 🍌",
  PRO: "🍌 Nano Banana Pro (Gemini 3 Pro) — 10 🍌",
  PRO4K: "🔥 Nano Banano Pro (4K) — 15 🍌"
};

const PRICES: Record<string, number> = {
  [MODELS.NANO2]: 5,
  [MODELS.PRO]: 10,
  [MODELS.PRO4K]: 15
};

const MODEL_NAME_TO_ID: Record<string, string> = {
  [MODELS.NANO2]: "gemini-3.1-flash-image-preview",
  [MODELS.PRO]: "gemini-3-pro-image-preview",
  [MODELS.PRO4K]: "gemini-3-pro-image-preview-4k",
};

const ADMIN_MAX_ID = "117704905"; // ID администратора в MAX

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function getUserId(ctx: any): string | null {
  const id = ctx.user?.user_id || 
             ctx.message?.sender?.user_id || 
             ctx.update?.message_callback?.sender?.user_id || 
             ctx.update?.message?.sender?.user_id ||
             ctx.update?.bot_started?.user?.user_id;
  return id ? id.toString() : null;
}

async function updateBotState(maxUserId: string, state: string, model: string | null = null) {
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ bot_state: state, bot_selected_model: model, bot_reference_url: null })
    .eq("max_user_id", maxUserId);

  if (error) console.error(`❌ Ошибка БД при смене статуса:`, error);
}

// ==================== УНИВЕРСАЛЬНАЯ ФУНКЦИЯ ДЛЯ СТАРТА ====================
async function handleUserStart(ctx: any) {
  const maxUserId = getUserId(ctx);
  if (!maxUserId) return;

  const senderName = ctx.message?.sender?.first_name || 
                     ctx.update?.bot_started?.user?.first_name || 
                     'друг';

  // Проверяем/создаем профиль
  let { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('max_user_id', maxUserId).maybeSingle();

  if (!profile) {
    const email = `max_${maxUserId}@klex.pro`;
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({ email, email_confirm: true });
    if (!authError) {
      const { data: newProfile } = await supabaseAdmin.from("profiles").upsert({
        id: authUser.user.id,
        max_user_id: maxUserId,
        telegram_first_name: senderName,
        balance: 50,
        bot_state: "idle",
      }).select().single();
      profile = newProfile;
    }
  }

  // Новое крутое описание
  // В названии KLEX․PRO используется спец. символ вместо точки, чтобы убрать превью картинки
  const welcomeText = 
    `Привет, ${senderName}! ✨\n\n` +
    `Добро пожаловать в **KLEX․PRO** — твой персональный ИИ-художник! 🍌\n\n` +
    `Я помогу тебе:\n` +
    `🎨 **Создавать** невероятные картины по описанию\n` +
    `📸 **Превращать** обычные фото в цифровое искусство\n` +
    `🚀 **Генерировать** контент за считанные секунды\n\n` +
    `🎁 Тебе начислено **50 🍌** (бананов) на первые шедевры!\n\n` +
    `Нажми кнопку ниже, чтобы открыть меню и начать творить.`;

  const welcomeButtons = [[Keyboard.button.callback("🚀 Поехали!", "action_home")]];
  
  await ctx.reply(welcomeText, {
    format: 'markdown',
    link_preview: false, 
    attachments: [Keyboard.inlineKeyboard(welcomeButtons)]
  });

  await updateBotState(maxUserId, "idle");
}

// ==================== ГЛАВНОЕ МЕНЮ (с автоопределением админа) ====================
async function sendMaxMainMenu(ctx: any) {
  const maxUserId = getUserId(ctx);
  const isAdmin = maxUserId === ADMIN_MAX_ID;

  const buttons = [
    [
      Keyboard.button.callback("🎨 Создать картинку", "action_create_image"),
      Keyboard.button.callback("🖼 Сгрен. по фото", "action_create_photo")
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

  if (isAdmin) buttons.push([Keyboard.button.callback("🔐 Админ-панель", "action_admin")]);

  await ctx.reply("Выберите действие:", {
    attachments: [Keyboard.inlineKeyboard(buttons)]
  });
}

// ==================== ИНФО-КНОПКИ И БАЛАНС ====================
bot.action('action_balance', async (ctx: any) => {
  const maxUserId = getUserId(ctx);
  if (!maxUserId) return;
  
  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('balance')
    .eq('max_user_id', maxUserId)
    .limit(1)
    .maybeSingle();
    
  if (error) console.error("Ошибка Баланса:", error);

  if (profile) {
    const keyboard = Keyboard.inlineKeyboard([
      [Keyboard.button.callback("💳 Пополнить баланс", "action_start_payment")]
    ]);
    await ctx.reply(`💰 *Ваш баланс:* ${profile.balance} 🍌\n\nЗдесь вы можете пополнить счет.`, { 
      format: 'markdown',
      attachments: [keyboard]
    });
  } else {
    await ctx.reply("❌ Профиль не найден. Пожалуйста, отправьте /start");
  }
});

bot.action('action_history', async (ctx: any) => ctx.reply("📂 История генераций скоро появится!", { format: 'markdown' }));
bot.action('action_help', async (ctx: any) => ctx.reply("🚀 *Помощь*\n\nВсё очень просто: жми на кнопки!", { format: 'markdown' }));
bot.action('action_settings', async (ctx: any) => ctx.reply("⚙️ Настройки в разработке.", { format: 'markdown' }));

// ==================== АДМИН-ПАНЕЛЬ ====================
bot.action('action_admin', async (ctx: any) => {
  const maxUserId = getUserId(ctx);
  
  // Доступ только для администратора
  if (maxUserId !== ADMIN_MAX_ID) {
    return ctx.reply("⛔️ Доступ ограничен. Эта зона только для администратора.");
  }

  const buttons = [
    [Keyboard.button.callback("📢 Создать рассылку", "admin_broadcast_start")],
    [Keyboard.button.callback("📊 Статистика", "admin_stats")],
    [Keyboard.button.callback("⬅️ Назад", "action_home")]
  ];

  await ctx.reply("🔐 **Панель управления KLEX**\n\nПривет, Алекс! Что планируем делать сегодня?", {
    format: 'markdown',
    attachments: [Keyboard.inlineKeyboard(buttons)]
  });
});

bot.action('admin_broadcast_start', async (ctx: any) => {
  const maxUserId = getUserId(ctx);
  if (maxUserId !== ADMIN_MAX_ID) return;

  // Переключаем статус админа на ожидание текста рассылки
  await updateBotState(maxUserId, "awaiting_broadcast_text");

  const keyboard = Keyboard.inlineKeyboard([[Keyboard.button.callback("❌ Отмена", "action_admin")]]);
  
  await ctx.reply("📢 **Подготовка рассылки**\n\nПришли следующим сообщением текст, который увидят все пользователи бота.\n\n_Поддерживается Markdown форматирование._", {
    format: 'markdown',
    attachments: [keyboard]
  });
});

bot.action('admin_stats', async (ctx: any) => {
  const maxUserId = getUserId(ctx);
  if (maxUserId !== ADMIN_MAX_ID) return;

  const { count, error } = await supabaseAdmin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .not('max_user_id', 'is', null);

  if (error) {
    await ctx.reply("❌ Ошибка получения статистики.");
    return;
  }

  await ctx.reply(`📊 **Статистика**\n\nВсего пользователей в MAX: ${count || 0}`, { format: 'markdown' });
});

// ==================== МАШИНА СОСТОЯНИЙ: ОБЫЧНЫЙ ФЛОУ (Text-to-Image) ====================
async function sendModelSelection(ctx: any, maxUserId: string) {
  await updateBotState(maxUserId, "choosing_model");
  const buttons = [
    [Keyboard.button.callback(MODELS.NANO2, "model_nano2")],
    [Keyboard.button.callback(MODELS.PRO, "model_pro")],
    [Keyboard.button.callback(MODELS.PRO4K, "model_pro4k")],
    [Keyboard.button.callback("⬅️ Назад", "action_back")]
  ];
  await ctx.reply("Выберите модель:", { attachments: [Keyboard.inlineKeyboard(buttons)] });
}

async function sendFormatSelection(ctx: any, maxUserId: string, modelDisplayName: string) {
  await updateBotState(maxUserId, "choosing_format", modelDisplayName);
  const buttons = [
    [Keyboard.button.callback("⬛ 1:1 (Квадрат)", "format_1:1")],
    [
      Keyboard.button.callback("📱 9:16 (Верт.)", "format_9:16"),
      Keyboard.button.callback("🖥 16:9 (Гориз.)", "format_16:9")
    ],
    [Keyboard.button.callback("⬅️ Назад", "action_back")]
  ];
  await ctx.reply(`Модель: *${modelDisplayName}*\n\nВыберите формат:`, { format: 'markdown', attachments: [Keyboard.inlineKeyboard(buttons)] });
}

async function handleFormatSelection(ctx: any, maxUserId: string, selectedFormat: string) {
  const { data: profile } = await supabaseAdmin.from('profiles').select('bot_selected_model').eq('max_user_id', maxUserId).maybeSingle();
  const oldModelName = profile?.bot_selected_model || MODELS.NANO2;
  const newModelStr = `${oldModelName}|${selectedFormat}`;

  await updateBotState(maxUserId, "awaiting_prompt", newModelStr);
  const keyboard = Keyboard.inlineKeyboard([[Keyboard.button.callback("⬅️ Назад", "action_back")]]);
  await ctx.reply(`✅ Формат *${selectedFormat}* выбран!\n\nНапишите текстом, что нужно создать ✍️`, { format: 'markdown', attachments: [keyboard] });
}

// ==================== МАШИНА СОСТОЯНИЙ: ФОТО-ФЛОУ (Image-to-Image) ====================
async function sendPhotoModelSelection(ctx: any, maxUserId: string) {
  await updateBotState(maxUserId, "choosing_photo_model");
  const buttons = [
    [Keyboard.button.callback(MODELS.NANO2, "photo_model_nano2")],
    [Keyboard.button.callback(MODELS.PRO, "photo_model_pro")],
    [Keyboard.button.callback(MODELS.PRO4K, "photo_model_pro4k")],
    [Keyboard.button.callback("⬅️ Назад", "action_back")]
  ];
  await ctx.reply("🖼 *Генерация по фото*\n\nВыберите модель:", { format: 'markdown', attachments: [Keyboard.inlineKeyboard(buttons)] });
}

async function sendPhotoFormatSelection(ctx: any, maxUserId: string, modelDisplayName: string) {
  await updateBotState(maxUserId, "choosing_photo_format", modelDisplayName);
  const buttons = [
    [Keyboard.button.callback("⬛ 1:1 (Квадрат)", "photo_format_1:1")],
    [
      Keyboard.button.callback("📱 9:16 (Верт.)", "photo_format_9:16"),
      Keyboard.button.callback("🖥 16:9 (Гориз.)", "photo_format_16:9")
    ],
    [Keyboard.button.callback("⬅️ Назад", "action_back")]
  ];
  await ctx.reply(`Модель: *${modelDisplayName}*\n\nВыберите формат:`, { format: 'markdown', attachments: [Keyboard.inlineKeyboard(buttons)] });
}

async function handlePhotoFormatSelection(ctx: any, maxUserId: string, selectedFormat: string) {
  const { data: profile } = await supabaseAdmin.from('profiles').select('bot_selected_model').eq('max_user_id', maxUserId).maybeSingle();
  const oldModelName = profile?.bot_selected_model || MODELS.NANO2;
  const newModelStr = `${oldModelName}|${selectedFormat}`;

  await updateBotState(maxUserId, "awaiting_photo", newModelStr);
  const keyboard = Keyboard.inlineKeyboard([[Keyboard.button.callback("⬅️ Назад", "action_back")]]);
  await ctx.reply(`✅ Формат *${selectedFormat}* выбран!\n\nТеперь, пожалуйста, **пришвартуйте (прикрепите) ваше фото** 📸`, { 
    format: 'markdown', 
    attachments: [keyboard] 
  });
}

// ==================== ЛОГИКА КНОПОК ====================

// --- ОБЫЧНЫЙ ФЛОУ (Text-to-Image) ---
bot.action('action_create_image', async (ctx: any) => { const id = getUserId(ctx); if (id) await sendModelSelection(ctx, id); });

bot.action('model_nano2', async (ctx: any) => { const id = getUserId(ctx); if (id) await sendFormatSelection(ctx, id, MODELS.NANO2); });
bot.action('model_pro', async (ctx: any) => { const id = getUserId(ctx); if (id) await sendFormatSelection(ctx, id, MODELS.PRO); });
bot.action('model_pro4k', async (ctx: any) => { const id = getUserId(ctx); if (id) await sendFormatSelection(ctx, id, MODELS.PRO4K); });

bot.action('format_1:1', async (ctx: any) => { const id = getUserId(ctx); if (id) await handleFormatSelection(ctx, id, '1:1'); });
bot.action('format_9:16', async (ctx: any) => { const id = getUserId(ctx); if (id) await handleFormatSelection(ctx, id, '9:16'); });
bot.action('format_16:9', async (ctx: any) => { const id = getUserId(ctx); if (id) await handleFormatSelection(ctx, id, '16:9'); });

// --- ФОТО ФЛОУ (Image-to-Image) ---
bot.action('action_create_photo', async (ctx: any) => { 
  const id = getUserId(ctx); 
  if (id) await sendPhotoModelSelection(ctx, id); 
});

bot.action('photo_model_nano2', async (ctx: any) => { const id = getUserId(ctx); if (id) await sendPhotoFormatSelection(ctx, id, MODELS.NANO2); });
bot.action('photo_model_pro', async (ctx: any) => { const id = getUserId(ctx); if (id) await sendPhotoFormatSelection(ctx, id, MODELS.PRO); });
bot.action('photo_model_pro4k', async (ctx: any) => { const id = getUserId(ctx); if (id) await sendPhotoFormatSelection(ctx, id, MODELS.PRO4K); });

bot.action('photo_format_1:1', async (ctx: any) => { const id = getUserId(ctx); if (id) await handlePhotoFormatSelection(ctx, id, '1:1'); });
bot.action('photo_format_9:16', async (ctx: any) => { const id = getUserId(ctx); if (id) await handlePhotoFormatSelection(ctx, id, '9:16'); });
bot.action('photo_format_16:9', async (ctx: any) => { const id = getUserId(ctx); if (id) await handlePhotoFormatSelection(ctx, id, '16:9'); });

// --- НАЧАЛО ОПЛАТЫ ---
bot.action('action_start_payment', async (ctx: any) => {
  const maxUserId = getUserId(ctx);
  if (!maxUserId) return;
  
  await updateBotState(maxUserId, "awaiting_payment_email", null);
  
  const keyboard = Keyboard.inlineKeyboard([[Keyboard.button.callback("⬅️ Назад", "action_back")]]);
  await ctx.reply("Введите ваш email для получения чека ✍️:", { 
    format: 'markdown', 
    attachments: [keyboard] 
  });
});

// ==================== УМНАЯ КНОПКА "НАЗАД" ====================
bot.action('action_back', async (ctx: any) => {
  const maxUserId = getUserId(ctx);
  if (!maxUserId) return;

  const { data: profile } = await supabaseAdmin.from("profiles").select("bot_state, bot_selected_model").eq("max_user_id", maxUserId).maybeSingle();
  const currentState = profile?.bot_state || "idle";
  const savedModelStr = profile?.bot_selected_model || "";
  const [modelName] = savedModelStr.split('|');

  switch (currentState) {
    // --- Обычный флоу Назад ---
    case "awaiting_prompt": {
      await sendFormatSelection(ctx, maxUserId, modelName || MODELS.NANO2);
      break;
    }
    case "choosing_format": {
      await sendModelSelection(ctx, maxUserId);
      break;
    }

    // --- ФОТО флоу Назад ---
    case "awaiting_photo": {
      await sendPhotoFormatSelection(ctx, maxUserId, modelName || MODELS.NANO2);
      break;
    }
    case "choosing_photo_format": {
      await sendPhotoModelSelection(ctx, maxUserId);
      break;
    }

    // --- Оплата флоу Назад ---
    case "awaiting_payment_email": {
      await updateBotState(maxUserId, "idle");
      await sendMaxMainMenu(ctx);
      break;
    }
    case "awaiting_payment_amount": {
      await updateBotState(maxUserId, "awaiting_payment_email", null);
      const keyboard = Keyboard.inlineKeyboard([[Keyboard.button.callback("⬅️ Назад", "action_back")]]);
      await ctx.reply("Пожалуйста, введите ваш email заново:", { attachments: [keyboard] });
      break;
    }

    // --- Дефолт (Главное меню) ---
    case "choosing_model":
    case "choosing_photo_model":
    default: {
      await updateBotState(maxUserId, "idle");
      await sendMaxMainMenu(ctx);
      break;
    }
  }
});

// ==================== КНОПКИ "ДОМОЙ", "ПОВТОРИТЬ" И "ЗАНОВО" ====================
bot.action('action_home', async (ctx: any) => {
  const maxUserId = getUserId(ctx);
  if (!maxUserId) return;
  await updateBotState(maxUserId, "idle");
  await sendMaxMainMenu(ctx);
});

bot.action('action_start_over', async (ctx: any) => {
  const maxUserId = getUserId(ctx);
  if (!maxUserId) return;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("bot_state")
    .eq("max_user_id", maxUserId)
    .maybeSingle();

  const currentState = profile?.bot_state;

  if (currentState === "awaiting_photo_prompt" || currentState === "awaiting_photo") {
    await sendPhotoModelSelection(ctx, maxUserId);
  } else {
    await sendModelSelection(ctx, maxUserId);
  }
});

bot.action('action_repeat_generation', async (ctx: any) => {
  const maxUserId = getUserId(ctx);
  if (!maxUserId) return;

  const { data: profile } = await supabaseAdmin.from("profiles").select("*").eq("max_user_id", maxUserId).maybeSingle();
  if (!profile) return;

  const currentState = profile.bot_state;
  const savedModelStr = profile.bot_selected_model || "";
  const parts = savedModelStr.split('|');
  
  if (parts.length < 3) {
     await ctx.reply("К сожалению, предыдущий запрос не сохранился. Пожалуйста, напишите его текстом.");
     return;
  }

  const prompt = parts.slice(2).join('|'); 

  if (currentState === "awaiting_prompt") {
     await handleTextGeneration(ctx, profile, prompt);
  } else if (currentState === "awaiting_photo_prompt") {
     await handlePhotoGeneration(ctx, profile, prompt);
  } else {
     await ctx.reply("Сессия устарела. Начните новую генерацию из Главного меню.");
  }
});

// ==================== ОБРАБОТКА СООБЩЕНИЙ ====================

// ✅ Правильное событие для кнопки "Начать" в MAX
bot.on('bot_started', async (ctx: any) => {
  console.log("Юзер нажал кнопку НАЧАТЬ (bot_started)");
  await handleUserStart(ctx);
});

// Основной обработчик сообщений
bot.on('message_created', async (ctx: any) => {
  const maxUserId = getUserId(ctx);
  if (!maxUserId) return;

  // 🛑 Игнорируем сообщения, отправленные самим ботом
  if (ctx.message?.sender?.is_bot) return; 

  const text = ctx.message?.body?.text || "";
  const attachments = ctx.message?.body?.attachments || [];

  // Если ввели /start руками — запускаем приветствие
  if (text.startsWith('/start')) {
    await handleUserStart(ctx);
    return;
  }

  // =========================================================================
  // ДАЛЬШЕ ИДЕТ ОСТАЛЬНАЯ ЛОГИКА (ГЕНЕРАЦИИ, ФОТО, РАССЫЛКА)
  // =========================================================================
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("max_user_id", maxUserId)
    .limit(1)
    .maybeSingle();

  if (!profile) return;
  const currentState = profile.bot_state || "idle";

  // Перехват текстовых команд из главного меню (если юзер вводит текст вместо кнопок)
  if (text === "💰 Баланс" || text === "action_balance") {
    const keyboard = Keyboard.inlineKeyboard([
      [Keyboard.button.callback("💳 Пополнить баланс", "action_start_payment")]
    ]);
    await ctx.reply(`💰 *Ваш баланс:* ${profile.balance} 🍌\n\nЗдесь вы можете пополнить счет.`, { 
      format: 'markdown',
      attachments: [keyboard]
    });
    return;
  }
  
  if (text === "📜 История" || text === "action_history") {
    await ctx.reply("📂 История генераций скоро появится!", { format: 'markdown' });
    return;
  }
  
  if (text === "❓ Помощь" || text === "action_help") {
    await ctx.reply("🚀 *Помощь*\n\nВсё очень просто: жми на кнопки!", { format: 'markdown' });
    return;
  }
  
  if (text === "⚙️ Настройки" || text === "action_settings") {
    await ctx.reply("⚙️ Настройки в разработке.", { format: 'markdown' });
    return;
  }
  
  if (text === "🎨 Создать картинку") {
    await sendModelSelection(ctx, maxUserId);
    return;
  }
  
  if (text === "🖼 Сгрен. по фото") {
    await sendPhotoModelSelection(ctx, maxUserId);
    return;
  }

  // --- РАССЫЛКА (админ) ---
  if (currentState === "awaiting_broadcast_text") {
    if (maxUserId !== ADMIN_MAX_ID) {
      await updateBotState(maxUserId, "idle");
      await sendMaxMainMenu(ctx);
      return;
    }

    const broadcastText = text;
    if (!broadcastText) {
      await ctx.reply("❌ Отправьте текст рассылки (не пустое сообщение).");
      return;
    }

    await ctx.reply("📢 Начинаю рассылку... Это может занять некоторое время.");

    const { data: users, error } = await supabaseAdmin
      .from('profiles')
      .select('max_user_id')
      .not('max_user_id', 'is', null);

    if (error || !users || users.length === 0) {
      await ctx.reply("❌ Нет пользователей для рассылки.");
      await updateBotState(maxUserId, "idle");
      await sendMaxMainMenu(ctx);
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const user of users) {
      try {
        await bot.api.sendMessageToUser(
          Number(user.max_user_id), 
          broadcastText, 
          { format: 'markdown' }
        );
        successCount++;
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (err) {
        console.error(`Ошибка отправки пользователю ${user.max_user_id}:`, err);
        failCount++;
      }
    }

    await ctx.reply(`✅ **Рассылка завершена**\n\nУспешно: ${successCount}\nОшибок: ${failCount}`, { format: 'markdown' });
    await updateBotState(maxUserId, "idle");
    await sendMaxMainMenu(ctx);
    return;
  }

  // --- ШАГ ОПЛАТЫ 1: Юзер вводит Email ---
  if (currentState === "awaiting_payment_email") {
    const email = text?.trim();
    if (!email || !email.includes('@') || !email.includes('.')) {
      await ctx.reply("❌ Пожалуйста, введите корректный email (например, example@domain.com).");
      return;
    }

    await supabaseAdmin
      .from("profiles")
      .update({
        bot_state: "awaiting_payment_amount",
        bot_selected_model: email, 
      })
      .eq("max_user_id", maxUserId);

    const keyboard = Keyboard.inlineKeyboard([[Keyboard.button.callback("⬅️ Назад", "action_back")]]);
    await ctx.reply("Введите сумму пополнения в рублях ✍️\n(Например: 100, 200 или 500)", { 
      attachments: [keyboard] 
    });
    return;
  }

  // --- ШАГ ОПЛАТЫ 2: Юзер вводит Сумму и получает ссылку ---
  if (currentState === "awaiting_payment_amount") {
    const amount = parseInt(text || "");
    if (isNaN(amount) || amount < 100) {
      await ctx.reply("❌ Минимальная сумма пополнения — 100 рублей.");
      return;
    }

    const userEmail = profile.bot_selected_model;
    if (!userEmail) {
      await updateBotState(maxUserId, "awaiting_payment_email", null);
      await ctx.reply("Произошла ошибка. Пожалуйста, введите email заново:");
      return;
    }

    await ctx.reply("⏳ Генерируем ссылку на оплату...");

    try {
      const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://klex.pro";
      
      const paymentResponse = await fetch(`${SITE_URL}/api/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          telegramUserId: profile.telegram_id || profile.max_user_id, 
          email: userEmail,
          from: 'max',
        }),
      });

      const paymentData = await paymentResponse.json();

      if (!paymentResponse.ok || !paymentData.confirmationUrl) {
        console.error("Payment API error:", paymentData);
        await ctx.reply("❌ Ошибка создания платежа. Попробуйте позже.");
      } else {
        const confirmationUrl = paymentData.confirmationUrl;
        await ctx.reply(`💳 **Пополнение на ${amount} ₽**\n\n🔗 [Нажмите сюда, чтобы перейти к оплате](${confirmationUrl})`, {
          format: 'markdown'
        });
      }
    } catch (err) {
      console.error("Ошибка при генерации ссылки:", err);
      await ctx.reply("❌ Произошла ошибка связи с сервером оплаты.");
    }

    await updateBotState(maxUserId, "idle", null);
    await sendMaxMainMenu(ctx);
    return;
  }

  // --- ШАГ 4 (ФОТО): Юзер прислал фото ---
  if (currentState === "awaiting_photo") {
    if (!attachments || attachments.length === 0) {
      await ctx.reply("Пожалуйста, пришвартуйте изображение 📸 или нажмите 'Назад'.");
      return;
    }

    const photoAttachment = attachments.find((a: any) => a.type === 'image' || a.type === 'photo');
    if (!photoAttachment) {
      await ctx.reply("Это не похоже на изображение. Пожалуйста, отправьте именно фото.");
      return;
    }

    try {
      const fileUrl = photoAttachment.payload?.url;
      
      if (!fileUrl) {
         console.error("Не найден URL файла во вложении!");
         await ctx.reply("Ошибка: не удалось прочитать ссылку на файл.");
         return;
      }

      const currentUrls = profile.bot_reference_url || [];
      const updatedUrls = [...currentUrls, fileUrl];

      await supabaseAdmin
        .from("profiles")
        .update({ 
          bot_state: "awaiting_photo_prompt", 
          bot_reference_url: updatedUrls 
        })
        .eq("max_user_id", maxUserId);

      const keyboard = Keyboard.inlineKeyboard([[Keyboard.button.callback("⬅️ Назад", "action_back")]]);
      await ctx.reply("📸 Фото принято!\n\nТеперь **напишите описание** (промпт) для генерации 🎨", {
        format: 'markdown',
        attachments: [keyboard]
      });

    } catch (error: any) {
      console.error("Ошибка обработки фото:", error);
      await ctx.reply("Не удалось сохранить фото. Попробуйте еще раз.");
    }
    return;
  }

  // --- ШАГ 5 (ФОТО): Юзер прислал промпт после фото ---
  if (currentState === "awaiting_photo_prompt") {
    if (!text) {
      await ctx.reply("Пожалуйста, напишите текстовое описание для вашего фото ✍️");
      return;
    }
    await handlePhotoGeneration(ctx, profile, text);
    return;
  }

  // --- ШАГ 3 (ТЕКСТ): Юзер прислал промпт (Обычный флоу) ---
  if (currentState === "awaiting_prompt") {
    if (!text) {
      await ctx.reply("Пожалуйста, напишите, что нужно создать ✍️");
      return;
    }
    await handleTextGeneration(ctx, profile, text);
    return;
  }

  // --- ОШИБКА: Защита от спама ---
  if (text) {
    await ctx.reply(`Я пока понимаю только нажатия на кнопки меню. Вызови /start, чтобы открыть меню!`);
  } else if (attachments && attachments.length > 0) {
    await ctx.reply("Сначала выберите действие \"🖼 Сгрен. по фото\" в меню.");
  }
});

// ==================== ФУНКЦИИ ГЕНЕРАЦИИ ====================

// --- ОБЫЧНАЯ ГЕНЕРАЦИЯ ---
async function handleTextGeneration(ctx: any, profile: any, prompt: string) {
  const maxUserId = profile.max_user_id;
  const savedModelStr = profile.bot_selected_model || `${MODELS.NANO2}|1:1`;
  const [modelDisplayName, formatFromDb] = savedModelStr.split('|');
  
  const cost = PRICES[modelDisplayName] || 5;
  const modelId = MODEL_NAME_TO_ID[modelDisplayName];

  // 🛑 ШАГ 1: СРАЗУ сбрасываем статус в idle. 
  // Это разорвет "петлю" повторных генераций, если Vercel будет долго думать.
  await updateBotState(maxUserId, "idle");

  await ctx.reply("🎨 Генерация запущена. Рисуем шедевр...");

  try {
    const result = await generateImageCore({
      userId: profile.id,
      prompt,
      modelId,
      aspectRatio: formatFromDb || "1:1",
      supabase: supabaseAdmin,
      imageBuffers: undefined
    });

    console.log("Успешная генерация! Сохраняем файл во временную папку Vercel...");

    const imageResponse = await fetch(result.imageUrl);
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extension = 'jpg';
    if (contentType.includes('webp')) extension = 'webp';
    else if (contentType.includes('png')) extension = 'png';

    // Формируем красивое имя и путь к временной папке /tmp
    const fileName = `KLEX_${Date.now()}.${extension}`;
    const tempFilePath = path.join(os.tmpdir(), fileName);

    // 1. Физически сохраняем файл на диск сервера (Vercel разрешает это только в /tmp)
    fs.writeFileSync(tempFilePath, buffer);

    try {
      // 2. Отправляем картинку как сжатое превью в чат
      const imageAttachment = await ctx.api.uploadImage({ source: buffer });
      await ctx.reply(`✨ Ваша генерация готова!`, { attachments: [imageAttachment.toJson()] });

      // 3. Отправляем ОРИГИНАЛЬНЫЙ ФАЙЛ (документом)
      // Передаем путь к файлу. Библиотека сама его прочитает и прикрепит правильное имя!
      const fileAttachment = await ctx.api.uploadFile({ source: tempFilePath });
      
      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback("🔄 Повторить", "action_repeat_generation")],
        [Keyboard.button.callback("🏠 Меню", "action_home")]
      ]);

      await ctx.reply(`📁 **Оригинал в максимальном качестве:**\n(Файл без сжатия прикреплен ниже)`, { 
        format: 'markdown',
        attachments: [fileAttachment.toJson(), keyboard] 
      });

    } finally {
      // 4. Обязательно удаляем файл с диска после отправки, чтобы память сервера не переполнилась
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }

  } catch (error: any) {
    console.error("ОШИБКА:", error);
    await supabaseAdmin.rpc('increment_balance', { user_id: profile.id, amount_to_add: cost });
    await ctx.reply("🛑 Ошибка генерации. Бананы возвращены!");
  }
}

// --- ГЕНЕРАЦИЯ ПО ФОТО ---
async function handlePhotoGeneration(ctx: any, profile: any, prompt: string) {
  const maxUserId = profile.max_user_id;
  const savedModelStr = profile.bot_selected_model || `${MODELS.NANO2}|1:1`;
  const [modelDisplayName, formatFromDb] = savedModelStr.split('|');
  
  const cost = PRICES[modelDisplayName] || 5;
  const modelId = MODEL_NAME_TO_ID[modelDisplayName];

  const referenceUrls = profile.bot_reference_url;
  if (!referenceUrls || referenceUrls.length === 0) {
    await ctx.reply("Ошибка: не найдено ни одного фото. Начните заново.");
    await updateBotState(maxUserId, "idle");
    await sendMaxMainMenu(ctx);
    return;
  }

  if (profile.balance < cost) {
    await ctx.reply(`❌ Недостаточно средств.\n\nВы выбрали модель за ${cost} 🍌, а у вас всего ${profile.balance} 🍌.`);
    await updateBotState(maxUserId, "idle");
    await sendMaxMainMenu(ctx);
    return;
  }

  // 🛑 ШАГ 1: СРАЗУ сбрасываем статус в idle. 
  await updateBotState(maxUserId, "idle");

  await ctx.reply("🎨 Генерация по фото запущена. Обрабатываем...");

  try {
    console.log("Скачиваем фото пользователя по URL:", referenceUrls[0]);
    const refResponse = await fetch(referenceUrls[0]);
    const refArrayBuffer = await refResponse.arrayBuffer();
    const userImageBuffer = Buffer.from(refArrayBuffer);

    const result = await generateImageCore({
      userId: profile.id,
      prompt: prompt,
      modelId,
      aspectRatio: formatFromDb || "1:1",
      supabase: supabaseAdmin,
      imageBuffers: [userImageBuffer] // 👈 Отличие только в этой строке
    });

    console.log("Успешная генерация! Сохраняем файл во временную папку Vercel...");

    const imageResponse = await fetch(result.imageUrl);
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await imageResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extension = 'jpg';
    if (contentType.includes('webp')) extension = 'webp';
    else if (contentType.includes('png')) extension = 'png';

    // Формируем красивое имя и путь к временной папке /tmp
    const fileName = `KLEX_${Date.now()}.${extension}`;
    const tempFilePath = path.join(os.tmpdir(), fileName);

    // 1. Физически сохраняем файл на диск сервера (Vercel разрешает это только в /tmp)
    fs.writeFileSync(tempFilePath, buffer);

    try {
      // 2. Отправляем картинку как сжатое превью в чат
      const imageAttachment = await ctx.api.uploadImage({ source: buffer });
      await ctx.reply(`✨ Ваша генерация по фото готова!`, { attachments: [imageAttachment.toJson()] });

      // 3. Отправляем ОРИГИНАЛЬНЫЙ ФАЙЛ (документом)
      // Передаем путь к файлу. Библиотека сама его прочитает и прикрепит правильное имя!
      const fileAttachment = await ctx.api.uploadFile({ source: tempFilePath });
      
      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback("🔄 Повторить", "action_repeat_generation")],
        [Keyboard.button.callback("🏠 Меню", "action_home")]
      ]);

      await ctx.reply(`📁 **Оригинал в максимальном качестве:**\n(Файл без сжатия прикреплен ниже)`, { 
        format: 'markdown',
        attachments: [fileAttachment.toJson(), keyboard] 
      });

    } finally {
      // 4. Обязательно удаляем файл с диска после отправки, чтобы память сервера не переполнилась
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }

  } catch (error: any) {
    console.error("ОШИБКА ГЕНЕРАЦИИ ПО ФОТО:", error);
    await supabaseAdmin.rpc('increment_balance', { user_id: profile.id, amount_to_add: cost });
    await ctx.reply("🛑 Ошибка генерации. Бананы возвращены!");
  }
}

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