import { NextResponse } from "next/server";
import { Bot, Keyboard } from '@maxhub/max-bot-api';
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { generateImageCore } from "@/app/lib/generateCore";

const MAX_TOKEN = process.env.BOT_TOKEN!;
if (!MAX_TOKEN) console.error("ОШИБКА: Не задан BOT_TOKEN в .env!");

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

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function getUserId(ctx: any): string | null {
  const id = ctx.user?.user_id || 
             ctx.message?.sender?.user_id || 
             ctx.update?.message_callback?.sender?.user_id || 
             ctx.update?.message?.sender?.user_id;
  return id ? id.toString() : null;
}

async function updateBotState(maxUserId: string, state: string, model: string | null = null) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({ bot_state: state, bot_selected_model: model, bot_reference_url: null })
    .eq("max_user_id", maxUserId)
    .select("bot_state")
    .single();

  if (error) console.error(`❌ Ошибка БД при смене статуса:`, error);
}

// ==================== ГЛАВНОЕ МЕНЮ ====================
async function sendMaxMainMenu(ctx: any, isAdmin: boolean = false) {
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

// ==================== КОМАНДА /START ====================
bot.command('start', async (ctx: any) => {
  const senderName = ctx.message?.sender?.first_name || 'друг';
  const maxUserId = getUserId(ctx);
  if (!maxUserId) return;

  console.log(`MAX /start от: ${senderName}, ID: ${maxUserId}`);

  // 1. Проверяем, пришел ли юзер с токеном синхронизации (например, "/start 123456")
  const text = ctx.message?.body?.text || "";
  const parts = text.split(" ");
  const token = parts.length > 1 ? parts[1] : null;

  if (token) {
    console.log(`Попытка синхронизации аккаунтов. Токен: ${token}`);
    
    // Ищем профиль с таким токеном, который еще не протух
    const { data: syncProfile, error: syncError } = await supabaseAdmin
      .from('profiles')
      .select('id, balance, max_link_expires')
      .eq('max_link_token', token)
      .maybeSingle();

    if (syncProfile) {
      // Проверяем срок действия токена
      const now = new Date();
      const expires = new Date(syncProfile.max_link_expires);
      
      if (now <= expires) {
        // УСПЕХ! Токен валиден. Привязываем max_user_id к этому (старому) профилю.
        console.log(`Синхронизация успешна! Привязываем MAX ID ${maxUserId} к профилю ${syncProfile.id}`);
        
        await supabaseAdmin
          .from('profiles')
          .update({
            max_user_id: maxUserId,
            bot_state: "idle",
            // Очищаем токен, чтобы его нельзя было использовать дважды
            max_link_token: null, 
            max_link_expires: null
          })
          .eq('id', syncProfile.id);

        await ctx.reply(`🎉 **Аккаунты успешно связаны!**\n\nТеперь у вас общий баланс с Telegram: **${syncProfile.balance} 🍌**`, { format: 'markdown' });
        await sendMaxMainMenu(ctx, false);
        return; // Завершаем выполнение, дальше идти не нужно
      } else {
        await ctx.reply("❌ Ссылка для привязки аккаунта устарела. Пожалуйста, сгенерируйте новую в Telegram-боте.");
      }
    } else {
      await ctx.reply("❌ Неверная или устаревшая ссылка для привязки аккаунта.");
    }
  }

  // =========================================================================
  // 2. ОБЫЧНЫЙ ВХОД (если токена нет или он оказался недействительным)
  // =========================================================================

  // Ищем, есть ли уже профиль с таким MAX ID
  let { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('max_user_id', maxUserId)
    .maybeSingle();

  // Если профиля нет — создаем новый
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
          telegram_first_name: senderName, // Сохраняем имя из MAX
          balance: 50, // Даем бонус новичку
          bot_state: "idle",
        })
        .select()
        .single();
      
      profile = newProfile;
      await ctx.reply(`Привет, ${senderName}! ✨ ИИ-бот KLEX.PRO дарит тебе 50 🍌 для старта!`);
    } else {
      console.error("Ошибка создания auth-юзера:", authError);
      await ctx.reply("Произошла ошибка при регистрации. Пожалуйста, попробуйте позже.");
      return;
    }
  } else {
    // Пользователь уже существует, просто здороваемся
    await ctx.reply(`С возвращением, ${senderName}! ✨`);
  }

  // Сбрасываем статус при входе
  if (profile) await updateBotState(maxUserId, "idle");
  
  // Показываем меню
  await sendMaxMainMenu(ctx, false);
});

// ==================== ИНФО-КНОПКИ ====================
bot.action('action_balance', async (ctx: any) => {
  const maxUserId = getUserId(ctx);
  if (!maxUserId) return;
  const { data: profile } = await supabaseAdmin.from('profiles').select('balance').eq('max_user_id', maxUserId).maybeSingle();
  if (profile) await ctx.reply(`💰 *Ваш баланс:* ${profile.balance} 🍌`, { format: 'markdown' });
});
bot.action('action_history', async (ctx: any) => ctx.reply("📂 История генераций скоро появится!", { format: 'markdown' }));
bot.action('action_help', async (ctx: any) => ctx.reply("🚀 *Помощь*\n\nВсё очень просто: жми на кнопки!", { format: 'markdown' }));
bot.action('action_settings', async (ctx: any) => ctx.reply("⚙️ Настройки в разработке.", { format: 'markdown' }));

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
      // От просьбы фото к выбору формата
      await sendPhotoFormatSelection(ctx, maxUserId, modelName || MODELS.NANO2);
      break;
    }
    case "choosing_photo_format": {
      // От формата к выбору модели
      await sendPhotoModelSelection(ctx, maxUserId);
      break;
    }

    // --- Дефолт (Главное меню) ---
    case "choosing_model":
    case "choosing_photo_model":
    default: {
      await updateBotState(maxUserId, "idle");
      await sendMaxMainMenu(ctx, false);
      break;
    }
  }
});

// ==================== КНОПКИ "ДОМОЙ", "ПОВТОРИТЬ" И "ЗАНОВО" ====================
bot.action('action_home', async (ctx: any) => {
  const maxUserId = getUserId(ctx);
  if (!maxUserId) return;
  await updateBotState(maxUserId, "idle");
  await sendMaxMainMenu(ctx, false);
});

// НОВОЕ: Начать заново (возврат к выбору модели)
bot.action('action_start_over', async (ctx: any) => {
  const maxUserId = getUserId(ctx);
  if (!maxUserId) return;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("bot_state")
    .eq("max_user_id", maxUserId)
    .maybeSingle();

  const currentState = profile?.bot_state;

  // Если мы были в генерации по фото, кидаем на выбор фото-модели
  if (currentState === "awaiting_photo_prompt" || currentState === "awaiting_photo") {
    await sendPhotoModelSelection(ctx, maxUserId);
  } else {
    // Иначе кидаем на обычный выбор модели
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
  
  // Если частей меньше 3, значит промпт еще не сохранялся
  if (parts.length < 3) {
     await ctx.reply("К сожалению, предыдущий запрос не сохранился. Пожалуйста, напишите его текстом.");
     return;
  }

  // Склеиваем текст обратно (на случай, если юзер сам использовал символ "|" в промпте)
  const prompt = parts.slice(2).join('|'); 

  // Запускаем нужную генерацию заново!
  if (currentState === "awaiting_prompt") {
     await handleTextGeneration(ctx, profile, prompt);
  } else if (currentState === "awaiting_photo_prompt") {
     await handlePhotoGeneration(ctx, profile, prompt);
  } else {
     await ctx.reply("Сессия устарела. Начните новую генерацию из Главного меню.");
  }
});

// ==================== ОБРАБОТКА СООБЩЕНИЙ ====================
bot.on('message_created', async (ctx: any) => {
  const maxUserId = getUserId(ctx);
  if (!maxUserId) return;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("max_user_id", maxUserId)
    .maybeSingle();

  if (!profile) return;

  const currentState = profile.bot_state || "idle";
  const text = ctx.message?.body?.text;
  
  // В MAX вложения лежат внутри объекта body
  const attachments = ctx.message?.body?.attachments; 

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
      // 1. БЕРЕМ ПРЯМУЮ ССЫЛКУ ИЗ СООБЩЕНИЯ (Спасибо, MAX!)
      const fileUrl = photoAttachment.payload?.url;
      
      if (!fileUrl) {
         console.error("Не найден URL файла во вложении!");
         await ctx.reply("Ошибка: не удалось прочитать ссылку на файл.");
         return;
      }

      // 2. Сохраняем URL картинки в базу
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
    if (!text || text.startsWith('/start')) {
      await ctx.reply("Пожалуйста, напишите текстовое описание для вашего фото ✍️");
      return;
    }
    await handlePhotoGeneration(ctx, profile, text);
    return;
  }

  // --- ШАГ 3 (ТЕКСТ): Юзер прислал промпт (Обычный флоу) ---
  if (currentState === "awaiting_prompt") {
    if (!text || text.startsWith('/start')) {
      await ctx.reply("Пожалуйста, напишите, что нужно создать ✍️");
      return;
    }
    await handleTextGeneration(ctx, profile, text);
    return;
  }

  // --- ОШИБКА: Защита от спама ---
  if (text && !text.startsWith('/start')) {
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
  const parts = savedModelStr.split('|');
  const modelDisplayName = parts[0];
  const formatFromDb = parts[1] || "1:1";
  
  const cost = PRICES[modelDisplayName] || 5;
  const modelId = MODEL_NAME_TO_ID[modelDisplayName] || "gemini-3.1-flash-image-preview";

  if (profile.balance < cost) {
    await ctx.reply(`❌ Недостаточно средств.\n\nВы выбрали модель за ${cost} 🍌, а у вас всего ${profile.balance} 🍌.`);
    await updateBotState(maxUserId, "idle");
    await sendMaxMainMenu(ctx, false);
    return;
  }

  // 1. СОХРАНЯЕМ ПРОМПТ В БАЗУ ДЛЯ ПОВТОРА (Модель|Формат|Промпт)
  const newModelStr = `${modelDisplayName}|${formatFromDb}|${prompt}`;
  await supabaseAdmin.from('profiles').update({ bot_selected_model: newModelStr }).eq('max_user_id', maxUserId);

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

    console.log("Успешная генерация! Скачиваем картинку...");

    const imageResponse = await fetch(result.imageUrl);
    const arrayBuffer = await imageResponse.arrayBuffer();
    const buffer: any = Buffer.from(arrayBuffer);
    buffer.path = "klex_image.jpg";
    buffer.name = "klex_image.jpg";

    const imageAttachment = await ctx.api.uploadImage({ source: buffer });
    const fileAttachment = await ctx.api.uploadFile({ source: buffer });

    await ctx.reply(`✨ Ваша генерация готова!`, { attachments: [imageAttachment.toJson()] });
    await ctx.reply(`📁 Оригинал в максимальном качестве:`, { attachments: [fileAttachment.toJson()] });

    // 2. ВЫВОДИМ КНОПКИ ПОВТОРА, ЗАНОВО И МЕНЮ
    const keyboard = Keyboard.inlineKeyboard([
      [Keyboard.button.callback("🔄 Повторить так же", "action_repeat_generation")],
      [Keyboard.button.callback("🆕 Начать заново", "action_start_over")],
      [Keyboard.button.callback("🏠 В главное меню", "action_home")]
    ]);
    await ctx.reply(`Вы можете нажать **«Повторить так же»** 🔄, отправить **новый текст** для изменения ✍️, начать новую генерацию или вернуться в меню:`, {
      format: 'markdown',
      attachments: [keyboard]
    });

  } catch (error: any) {
    console.error("ОШИБКА ГЕНЕРАЦИИ MAX:", error);
    await supabaseAdmin.rpc('increment_balance', { user_id: profile.id, amount_to_add: cost });
    await ctx.reply("Хьюстон, у нас проблемы! 🛑 Не удалось отправить картинку. Бананы мы тебе вернули!");
    await updateBotState(maxUserId, "idle");
    await sendMaxMainMenu(ctx, false);
  }
}

// --- ГЕНЕРАЦИЯ ПО ФОТО ---
async function handlePhotoGeneration(ctx: any, profile: any, prompt: string) {
  const maxUserId = profile.max_user_id;
  const savedModelStr = profile.bot_selected_model || `${MODELS.NANO2}|1:1`;
  const parts = savedModelStr.split('|');
  const modelDisplayName = parts[0];
  const formatFromDb = parts[1] || "1:1";
  
  const cost = PRICES[modelDisplayName] || 5;
  const modelId = MODEL_NAME_TO_ID[modelDisplayName] || "gemini-3.1-flash-image-preview";

  const referenceUrls = profile.bot_reference_url;
  if (!referenceUrls || referenceUrls.length === 0) {
    await ctx.reply("Ошибка: не найдено ни одного фото. Начните заново.");
    await updateBotState(maxUserId, "idle");
    await sendMaxMainMenu(ctx, false);
    return;
  }

  if (profile.balance < cost) {
    await ctx.reply(`❌ Недостаточно средств.\n\nВы выбрали модель за ${cost} 🍌, а у вас всего ${profile.balance} 🍌.`);
    await updateBotState(maxUserId, "idle");
    await sendMaxMainMenu(ctx, false);
    return;
  }

  // 1. СОХРАНЯЕМ ПРОМПТ В БАЗУ ДЛЯ ПОВТОРА
  const newModelStr = `${modelDisplayName}|${formatFromDb}|${prompt}`;
  await supabaseAdmin.from('profiles').update({ bot_selected_model: newModelStr }).eq('max_user_id', maxUserId);

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
      imageBuffers: [userImageBuffer]
    });

    console.log("Успешная генерация по фото! Скачиваем результат...");

    const imageResponse = await fetch(result.imageUrl);
    const arrayBuffer = await imageResponse.arrayBuffer();
    const buffer: any = Buffer.from(arrayBuffer);
    buffer.path = "klex_image.jpg";
    buffer.name = "klex_image.jpg";

    const imageAttachment = await ctx.api.uploadImage({ source: buffer });
    const fileAttachment = await ctx.api.uploadFile({ source: buffer });

    await ctx.reply(`✨ Ваша генерация по фото готова!`, { attachments: [imageAttachment.toJson()] });
    await ctx.reply(`📁 Оригинал в максимальном качестве:`, { attachments: [fileAttachment.toJson()] });

    // 2. ВЫВОДИМ КНОПКИ ПОВТОРА, ЗАНОВО И МЕНЮ
    const keyboard = Keyboard.inlineKeyboard([
      [Keyboard.button.callback("🔄 Повторить так же", "action_repeat_generation")],
      [Keyboard.button.callback("🆕 Начать заново", "action_start_over")],
      [Keyboard.button.callback("🏠 В главное меню", "action_home")]
    ]);
    await ctx.reply(`Вы можете нажать **«Повторить так же»** 🔄, написать **новый промпт** для этого же фото ✍️, начать заново или вернуться в меню:`, {
      format: 'markdown',
      attachments: [keyboard]
    });

  } catch (error: any) {
    console.error("ОШИБКА ГЕНЕРАЦИИ ПО ФОТО MAX:", error);
    await supabaseAdmin.rpc('increment_balance', { user_id: profile.id, amount_to_add: cost });
    await ctx.reply("Хьюстон, у нас проблемы! 🛑 Не удалось сгенерировать картинку. Бананы мы тебе вернули!");
    await updateBotState(maxUserId, "idle");
    await sendMaxMainMenu(ctx, false);
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