import { NextResponse } from "next/server";
import { Bot, Keyboard } from '@maxhub/max-bot-api';
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { generateImageCore } from "@/app/lib/generateCore"; // 👈 ИМПОРТИРОВАЛИ ТВОЕ ЯДРО НЕЙРОСЕТИ

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

  let { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('max_user_id', maxUserId).maybeSingle();

  if (!profile) {
    const email = `max_${maxUserId}@klex.pro`;
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({ email, email_confirm: true });

    if (!authError) {
      const { data: newProfile } = await supabaseAdmin
        .from("profiles")
        .upsert({
          id: authUser.user.id,
          max_user_id: maxUserId,
          telegram_first_name: senderName,
          balance: 50,
          bot_state: "idle",
        }).select().single();
      
      profile = newProfile;
      await ctx.reply(`Привет, ${senderName}! ✨ ИИ-бот KLEX.PRO дарит тебе 50 🍌 для старта!`);
    }
  } else {
    await ctx.reply(`С возвращением, ${senderName}! ✨`);
  }

  if (profile) await updateBotState(maxUserId, "idle");
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
bot.action('action_create_photo', async (ctx: any) => ctx.reply("🖼 Генерация по фото скоро появится!"));

// ==================== МАШИНА СОСТОЯНИЙ ====================
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

bot.action('action_create_image', async (ctx: any) => { const id = getUserId(ctx); if (id) await sendModelSelection(ctx, id); });
bot.action('model_nano2', async (ctx: any) => { const id = getUserId(ctx); if (id) await sendFormatSelection(ctx, id, MODELS.NANO2); });
bot.action('model_pro', async (ctx: any) => { const id = getUserId(ctx); if (id) await sendFormatSelection(ctx, id, MODELS.PRO); });
bot.action('model_pro4k', async (ctx: any) => { const id = getUserId(ctx); if (id) await sendFormatSelection(ctx, id, MODELS.PRO4K); });
bot.action('format_1:1', async (ctx: any) => { const id = getUserId(ctx); if (id) await handleFormatSelection(ctx, id, '1:1'); });
bot.action('format_9:16', async (ctx: any) => { const id = getUserId(ctx); if (id) await handleFormatSelection(ctx, id, '9:16'); });
bot.action('format_16:9', async (ctx: any) => { const id = getUserId(ctx); if (id) await handleFormatSelection(ctx, id, '16:9'); });

bot.action('action_back', async (ctx: any) => {
  const maxUserId = getUserId(ctx);
  if (!maxUserId) return;
  const { data: profile } = await supabaseAdmin.from("profiles").select("bot_state, bot_selected_model").eq("max_user_id", maxUserId).maybeSingle();
  const currentState = profile?.bot_state || "idle";

  switch (currentState) {
    case "awaiting_prompt": {
      const savedModelStr = profile?.bot_selected_model || "";
      const [modelName] = savedModelStr.split('|');
      await sendFormatSelection(ctx, maxUserId, modelName || MODELS.NANO2);
      break;
    }
    case "choosing_format":
    case "choosing_photo_format": {
      await sendModelSelection(ctx, maxUserId);
      break;
    }
    default: {
      await updateBotState(maxUserId, "idle");
      await sendMaxMainMenu(ctx, false);
      break;
    }
  }
});


// ==================== МАГИЯ: ОБРАБОТКА ТЕКСТА И ГЕНЕРАЦИЯ ====================
bot.on('message_created', async (ctx: any) => {
  const text = ctx.message?.body?.text;
  if (!text || text.startsWith('/start')) return;

  const maxUserId = getUserId(ctx);
  if (!maxUserId) return;

  // Ищем профиль пользователя в базе
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("max_user_id", maxUserId)
    .maybeSingle();

  if (!profile) return;

  const currentState = profile.bot_state || "idle";

  // Если бот ждет промпт (пользователь выбрал модель и формат)
  if (currentState === "awaiting_prompt") {
    
    // 1. Достаем настройки генерации
    const savedModelStr = profile.bot_selected_model || `${MODELS.NANO2}|1:1`;
    const [modelDisplayName, formatFromDb] = savedModelStr.split('|');
    const cost = PRICES[modelDisplayName] || 5;
    const modelId = MODEL_NAME_TO_ID[modelDisplayName] || "gemini-3.1-flash-image-preview";

    // 2. Проверяем баланс
    if (profile.balance < cost) {
      await ctx.reply(`❌ Недостаточно средств.\n\nВы выбрали модель за ${cost} 🍌, а у вас всего ${profile.balance} 🍌.`);
      await updateBotState(maxUserId, "idle");
      await sendMaxMainMenu(ctx, false);
      return;
    }

    // 3. Отправляем сообщение-заглушку "в процессе"
    await ctx.reply("🎨 Генерация запущена. Рисуем шедевр...");

    try {
      // 4. ВЫЗЫВАЕМ ТВОЕ ИИ-ЯДРО (Передаем profile.id, чтобы история привязалась к его аккаунту)
      const result = await generateImageCore({
        userId: profile.id, 
        prompt: text,
        modelId: modelId,
        aspectRatio: formatFromDb || "1:1",
        supabase: supabaseAdmin,
        imageBuffers: undefined
      });

      // 5. Загружаем полученный URL картинки на серверы MAX
      const imageAttachment = await ctx.api.uploadImage({ url: result.imageUrl });
      
      // 6. Отправляем картинку в чат
      await ctx.reply(`✨ Ваша генерация готова!`, {
        attachments: [imageAttachment.toJson()]
      });

    } catch (error: any) {
      console.error("ОШИБКА ГЕНЕРАЦИИ MAX:", error);
      
      // ВОЗВРАТ СРЕДСТВ: Если ИИ заблокировал промпт, возвращаем бананы
      await supabaseAdmin.rpc('increment_balance', { 
        user_id: profile.id, 
        amount_to_add: cost
      });

      await ctx.reply("Хьюстон, у нас фильтры! 🛑 ИИ посчитал этот запрос небезопасным. Бананы мы тебе вернули!");
    }

    // 7. Возвращаем бота в исходное состояние и показываем меню
    await updateBotState(maxUserId, "idle");
    await sendMaxMainMenu(ctx, false);
    return;
  }

  // Если пишут текст в любом другом состоянии
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