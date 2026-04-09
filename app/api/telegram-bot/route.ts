import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateImageCore } from "@/app/lib/generateCore";
import { Bot as MaxBot } from '@maxhub/max-bot-api'; // Добавлено

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL!; // URL вашего сайта для API оплаты
const ADMIN_ID = 323655436; // 👈 ID администратора для уведомлений и админ‑панели
const MAX_BOT_TOKEN = process.env.MAX_BOT_TOKEN!; // Добавлено
const maxBot = new MaxBot(MAX_BOT_TOKEN); // Добавлено

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log("SUPABASE URL:", SUPABASE_URL);
console.log("SERVICE ROLE EXISTS:", !!SUPABASE_SERVICE_ROLE_KEY);

// ==================== ЗОЛОТОЙ СТАНДАРТ НАЗВАНИЙ ====================
const MODELS = {
  NANO2: "🍌 Nano Banano 2 (Gemini 3.1 Flash) — 5 🍌",
  PRO: "🍌 Nano Banano Pro (Gemini 3 Pro) — 10 🍌",
  PRO4K: "🔥 Nano Banano Pro (4K) — 20 🍌"
};

const PRICES: Record<string, number> = {
  [MODELS.NANO2]: 5,
  [MODELS.PRO]: 10,
  [MODELS.PRO4K]: 20
};

// Маппинг названий моделей (с ценой) на ID для API
const MODEL_NAME_TO_ID: Record<string, string> = {
  [MODELS.NANO2]: "gemini-3.1-flash-image-preview",
  [MODELS.PRO]: "gemini-3-pro-image-preview",
  [MODELS.PRO4K]: "gemini-3-pro-image-preview-4k",
};

// Типы состояний бота (для документации)
type UserState =
  | "idle"
  | "choosing_model"
  | "choosing_format"
  | "choosing_photo_model"
  | "choosing_photo_format"
  | "awaiting_prompt"
  | "awaiting_photo"
  | "awaiting_photo_prompt"
  | "awaiting_payment_email"
  | "awaiting_payment_amount"
  | "awaiting_broadcast_tg"
  | "awaiting_broadcast_max";

/**
 * Ищет в тексте формат (например, 21:9, 9 на 16 или 1:1).
 * Теперь поддерживает панорамный режим 21:9.
 */
function extractAspectRatio(text: string): string {
  const ratioRegex = /(\d{1,2})[:\sнаx]+(\d{1,2})/;
  const match = text.match(ratioRegex);
  
  const supportedRatios = ['1:1', '9:16', '16:9', '4:3', '3:4', '2:3', '3:2', '21:9'];
  
  if (match) {
    const foundRatio = `${match[1]}:${match[2]}`;
    if (supportedRatios.includes(foundRatio)) {
      return foundRatio;
    }
  }
  
  return "1:1";
}

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

// ==================== ОБНОВЛЁННОЕ ГЛАВНОЕ МЕНЮ ====================
async function sendMainMenu(chatId: number) {
  // 1. Проверяем: админ или обычный пользователь
  const isAdmin = chatId === Number(ADMIN_ID);

  // 2. Базовый набор кнопок для всех
  const keyboard = [
    [{ text: "🎨 Создать картинку" }, { text: "🖼 Сгенерировать по фото" }],
    [{ text: "💰 Баланс" }, { text: "📜 История" }],
    [{ text: "⚙️ Настройки" }, { text: "❓ Помощь" }],
  ];

  // 3. Если админ – добавляем кнопку админ‑панели в конец
  if (isAdmin) {
    keyboard.push([{ text: "🔐 Админ-панель" }]);
  }

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "Выберите действие:",
      reply_markup: {
        keyboard: keyboard,
        resize_keyboard: true,
      },
    }),
  });
}

/**
 * Отправляет фото в Telegram, загружая его по URL и передавая как бинарные данные (multipart/form-data)
 */
async function sendPhotoBuffer(chatId: number, imageUrl: string) {
  const imageResponse = await fetch(imageUrl);
  const buffer = await imageResponse.arrayBuffer();

  const formData = new FormData();
  formData.append("chat_id", chatId.toString());
  formData.append(
    "photo",
    new Blob([buffer], { type: "image/jpeg" }),
    "image.jpg"
  );

  const res = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`,
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await res.json();
  console.log("SEND PHOTO RESPONSE:", data);
}

/**
 * Отправляет изображение как файл (без сжатия)
 */
async function sendDocumentBuffer(chatId: number, imageUrl: string) {
  const imageResponse = await fetch(imageUrl);
  const buffer = await imageResponse.arrayBuffer();

  const formData = new FormData();
  formData.append("chat_id", chatId.toString());
  formData.append(
    "document",
    new Blob([buffer], { type: "image/jpeg" }),
    "nano_banano_result.jpg"
  );

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
    method: "POST",
    body: formData,
  });
}

/**
 * Загружает несколько изображений по URL и возвращает массив буферов
 */
async function fetchImageBuffers(urls: string[]): Promise<Buffer[]> {
  const buffers: Buffer[] = [];
  for (const url of urls) {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    buffers.push(Buffer.from(arrayBuffer));
  }
  return buffers;
}

// ==================== ЦЕНТРАЛИЗОВАННАЯ ОБРАБОТКА НАЗАД ====================
async function handleBackNavigation(chatId: number, profile: any) {
  const currentState = profile.bot_state;

  switch (currentState) {
    case "choosing_model":
    case "choosing_photo_model":
      // Назад из выбора модели -> В главное меню
      await supabase
        .from("profiles")
        .update({ bot_state: "idle", bot_selected_model: null, bot_reference_url: null })
        .eq("id", profile.id);
      await sendMainMenu(chatId);
      break;

    case "choosing_format":
      // Назад из формата текста -> К выбору моделей текста
      await supabase
        .from("profiles")
        .update({ bot_state: "choosing_model" })
        .eq("id", profile.id);
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Выберите модель:",
          reply_markup: {
            keyboard: [
              [{ text: MODELS.NANO2 }],
              [{ text: MODELS.PRO }],
              [{ text: MODELS.PRO4K }],
              [{ text: "⬅️ Назад" }],
            ],
            resize_keyboard: true,
          },
        }),
      });
      break;

    case "choosing_photo_format":
      // Назад из формата фото -> К выбору моделей фото
      await supabase
        .from("profiles")
        .update({ bot_state: "choosing_photo_model", bot_reference_url: null })
        .eq("id", profile.id);
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Выберите модель для генерации по фото:",
          reply_markup: {
            keyboard: [
              [{ text: MODELS.NANO2 }],
              [{ text: MODELS.PRO }],
              [{ text: MODELS.PRO4K }],
              [{ text: "⬅️ Назад" }],
            ],
            resize_keyboard: true,
          },
        }),
      });
      break;

    case "awaiting_prompt":
      // Назад из промпта -> К выбору формата текста
      await supabase
        .from("profiles")
        .update({ bot_state: "choosing_format" })
        .eq("id", profile.id);
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Выберите нужный формат изображения:",
          reply_markup: {
            keyboard: [
              [{ text: "⬛ 1:1 (Квадрат)" }],
              [{ text: "📱 9:16 (Вертикальный)" }, { text: "🖥 16:9 (Горизонтальный)" }],
              [{ text: "⬅️ Назад" }],
            ],
            resize_keyboard: true,
          },
        }),
      });
      break;

    case "awaiting_photo":
      // Назад из загрузки фото -> К выбору формата фото
      await supabase
        .from("profiles")
        .update({ bot_state: "choosing_photo_format" })
        .eq("id", profile.id);
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Выберите формат для генерации по фото:",
          reply_markup: {
            keyboard: [
              [{ text: "⬛ 1:1 (Квадрат)" }],
              [{ text: "📱 9:16 (Вертикальный)" }, { text: "🖥 16:9 (Горизонтальный)" }],
              [{ text: "⬅️ Назад" }],
            ],
            resize_keyboard: true,
          },
        }),
      });
      break;

    case "awaiting_photo_prompt":
      // Назад из промпта по фото -> К загрузке фото
      await supabase
        .from("profiles")
        .update({ bot_state: "awaiting_photo" })
        .eq("id", profile.id);
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Вы вернулись к загрузке фото. Можете добавить еще или нажать 'Готово'.",
          reply_markup: {
            keyboard: [[{ text: "✅ Готово" }], [{ text: "⬅️ Назад" }]],
            resize_keyboard: true,
          },
        }),
      });
      break;

    case "awaiting_payment_email":
      // Назад из ввода email -> возврат в меню баланса (inline-кнопка)
      await supabase
        .from("profiles")
        .update({ bot_state: "idle", bot_selected_model: null })
        .eq("id", profile.id);
      // Показываем баланс с кнопкой пополнения (как при нажатии "💰 Баланс")
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `💰 *Ваш баланс:* ${profile.balance} 🍌\n\n` +
                `_Нажимая кнопку «Пополнить», вы принимаете условия_ [Публичной оферты](https://telegra.ph/PUBLICHNAYA-OFERTA-03-06-6) _и_ [Политики конфиденциальности](https://telegra.ph/Politika-konfidencialnosti-03-06-35).`,
          parse_mode: "Markdown",
          link_preview_options: { is_disabled: true },
          reply_markup: {
            inline_keyboard: [[{ text: "💳 Пополнить баланс", callback_data: "start_payment" }]]
          },
        }),
      });
      break;

    case "awaiting_payment_amount":
      // Назад из ввода суммы -> возврат к вводу email
      await supabase
        .from("profiles")
        .update({ bot_state: "awaiting_payment_email", bot_selected_model: null })
        .eq("id", profile.id);
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Введите ваш email для получения чека:",
          reply_markup: {
            keyboard: [[{ text: "⬅️ Назад" }]],
            resize_keyboard: true,
          },
        }),
      });
      break;

    default:
      // Если состояние неизвестно или idle, просто показываем главное меню
      await supabase
        .from("profiles")
        .update({ bot_state: "idle", bot_selected_model: null, bot_reference_url: null })
        .eq("id", profile.id);
      await sendMainMenu(chatId);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("UPDATE RECEIVED:", JSON.stringify(body, null, 2));

    // ========== ОБРАБОТКА CALLBACK_QUERY (нажатие inline-кнопок) ==========
    if (body.callback_query) {
      const cb = body.callback_query;
      const cbChatId = cb.message.chat.id;
      const cbTelegramId = cb.from.id;
      const cbData = cb.data;

      // Получаем профиль по telegram_id из callback
      const { data: cbProfile, error: cbProfileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("telegram_id", cbTelegramId)
        .maybeSingle();

      if (cbProfileError) {
        console.error("CALLBACK PROFILE ERROR:", cbProfileError);
        return NextResponse.json({ ok: true });
      }

      if (!cbProfile) {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_query_id: cb.id,
            text: "Профиль не найден. Начните с /start",
          }),
        });
        return NextResponse.json({ ok: true });
      }

      // Обработка нажатия кнопки "Пополнить баланс"
      if (cbData === "start_payment") {
        // Переходим в состояние запроса email
        await supabase
          .from("profiles")
          .update({
            bot_state: "awaiting_payment_email",
            bot_selected_model: null, // очищаем возможный предыдущий email
          })
          .eq("id", cbProfile.id);

        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: cbChatId,
            text: "Введите ваш email для получения чека:",
            reply_markup: {
              keyboard: [[{ text: "⬅️ Назад" }]],
              resize_keyboard: true,
            },
          }),
        });

        // Закрываем "часики" на кнопке
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: cb.id }),
        });

        return NextResponse.json({ ok: true });
      }

      // Если другие callback'и – можно добавить позже
    }

    // ========== ТЕПЕРЬ ПОЛУЧАЕМ ОБЫЧНОЕ СООБЩЕНИЕ ==========
    const message = body.message;
    if (!message) return NextResponse.json({ ok: true });

    const chatId = message.chat.id;
    const telegramId = message.from.id;
    const username = message.from.username || `telegram_${telegramId}`;
    const text = message.text;
    const photo = message.photo;

    // ========== ПОЛУЧАЕМ ИЛИ СОЗДАЁМ ПРОФИЛЬ ==========
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    if (profileError) {
      console.error("PROFILE SELECT ERROR:", profileError);
    }

    let profile = profileData;

    if (!profile) {
      console.log("Creating new Telegram user...");

      const email = `telegram_${telegramId}@klex.pro`;
      let userId: string;

      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers.users.find((u) => u.email === email);

      if (existingUser) {
        userId = existingUser.id;
      } else {
        const { data: authUser, error: authError } =
          await supabase.auth.admin.createUser({
            email,
            email_confirm: true,
          });

        if (authError) {
          console.error("AUTH CREATE ERROR:", authError);
          return NextResponse.json({ ok: true });
        }

        userId = authUser.user.id;
      }

      // Используем upsert для защиты от гонок (если профиль уже создан)
      const { data: newProfile, error } = await supabase
        .from("profiles")
        .upsert({
          id: userId,
          telegram_id: telegramId,
          telegram_username: username,
          balance: 10,
          bot_state: "idle",
          bot_selected_model: null,
          bot_reference_url: null,
          referrer_id: null, // для нового пользователя поле пригласившего отсутствует
        })
        .select()
        .single();

      if (error) {
        console.error("PROFILE UPSERT ERROR:", error);
        return NextResponse.json({ ok: true });
      }

      profile = newProfile;
    }

    const currentState = profile.bot_state ?? "idle";

    // ================== ГЛОБАЛЬНЫЙ ПЕРЕХВАТ КНОПКИ "НАЗАД" ==================
    if (text === "⬅️ Назад") {
      console.log("BACK NAVIGATION TRIGGERED");
      await handleBackNavigation(chatId, profile);
      return NextResponse.json({ ok: true });
    }

    // ================== ОБРАБОТКА КОМАНД ==================

    // ================== ОБРАБОТКА КОМАНДЫ /START ==================
    if (text?.startsWith("/start")) {
      const parts = text.split(" ");
      // Если ссылка была t.me/bot?start=Alex, то parts[1] будет "Alex"
      const refCodeFromUrl = parts.length > 1 ? parts[1] : null;

      // Обновляем профиль: ставим статус idle и привязываем красивый код (username)
      await supabase
        .from("profiles")
        .update({ 
          bot_state: "idle",
          referral_code: username // Твой ник становится твоим кодом для друзей
        })
        .eq("id", profile.id);

      // Проверяем: это новый пользователь или "старичок"?
      // (если у него еще нет referrer_id и он создан только что)
      const isNewUser = !profile.referrer_id; 

      if (refCodeFromUrl && isNewUser) {
        // Вызываем обновленную функцию
        const { data: result, error: refError } = await supabase.rpc('handle_referral', {
          new_user_id: profile.id,
          ref_code: refCodeFromUrl
        });

        if (!refError) {
          if (result === 'success') {
            await sendMessage(chatId, "🎁 Привет! Вы зашли по приглашению. Вашему другу начислено 10 🍌!");
            // Уведомление администратору о новом реферале
            await sendMessage(ADMIN_ID, `🔔 *Реферал!* \nКто-то только что пришел по ссылке. Пригласившему начислено 10 🍌`);
          } else if (result === 'self_referral') {
            await sendMessage(chatId, "🍌 Это ваша собственная ссылка. Приглашайте друзей, чтобы получать бонусы!");
          }
          // Остальные случаи (уже приглашен или код не найден) просто игнорируем, чтобы не спамить
        }
      }

      await sendMessage(
        chatId,
        "Привет! ИИ-бот KLEX.PRO открывает вам доступ к лучшим нейросетям для создания изображений."
      );

      await sendMainMenu(chatId);
      return NextResponse.json({ ok: true });
    }

    if (text === "🎨 Создать картинку") {
      await supabase
        .from("profiles")
        .update({ bot_state: "choosing_model", bot_reference_url: null })
        .eq("id", profile.id);

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Выберите модель:",
          reply_markup: {
            keyboard: [
              [{ text: MODELS.NANO2 }],
              [{ text: MODELS.PRO }],
              [{ text: MODELS.PRO4K }],
              [{ text: "❓ В чем разница?" }],
              [{ text: "⬅️ Назад" }],
            ],
            resize_keyboard: true,
          },
        }),
      });

      return NextResponse.json({ ok: true });
    }

    if (text === "🖼 Сгенерировать по фото") {
      await supabase
        .from("profiles")
        .update({
          bot_state: "choosing_photo_model",
          bot_selected_model: null,
          bot_reference_url: null,
        })
        .eq("id", profile.id);

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Выберите модель для генерации по фото:",
          reply_markup: {
            keyboard: [
              [{ text: MODELS.NANO2 }],
              [{ text: MODELS.PRO }],
              [{ text: MODELS.PRO4K }],
              [{ text: "❓ В чем разница?" }],
              [{ text: "⬅️ Назад" }],
            ],
            resize_keyboard: true,
          },
        }),
      });

      return NextResponse.json({ ok: true });
    }

    // 💰 Баланс + 👥 Рефералы + ⚖️ Юридическая инфо
    if (text === "💰 Баланс") {
      await supabase
        .from("profiles")
        .update({ bot_state: "idle", bot_selected_model: null, bot_reference_url: null })
        .eq("id", profile.id);

      // Авто-определение имени бота (чтобы ссылка не ломалась при переносе в main)
      const botInfo = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`).then(res => res.json());
      const botUsername = botInfo.result.username;
      
      const refCode = profile.referral_code || username;
      const refLink = `https://t.me/${botUsername}?start=${refCode}`;

      const balanceText = 
        `💰 *Ваш баланс:* ${profile.balance} 🍌\n\n` +
        `👥 *Приглашено друзей:* ${profile.referrals_count || 0}\n` +
        `🎁 За каждого друга: *10 🍌*\n\n` +
        `🔗 *Ваша ссылка для приглашения:* \n\`${refLink}\` \n\n` +
        `───\n` +
        `⚖️ [Публичная оферта](https://telegra.ph/PUBLICHNAYA-OFERTA-03-06-6)\n` +
        `🔒 [Политика конфиденциальности](https://telegra.ph/Politika-konfidencialnosti-03-06-35)\n\n` +
        `_Нажимая «Пополнить», вы принимаете условия документов._`;

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: balanceText,
          parse_mode: "Markdown",
          link_preview_options: { is_disabled: true },
          reply_markup: {
            inline_keyboard: [[{ text: "💳 Пополнить баланс", callback_data: "start_payment" }]]
          },
        }),
      });
      return NextResponse.json({ ok: true });
    }

    // 📜 История с персональным ID
    if (text === "📜 История") {
      await supabase
        .from("profiles")
        .update({ bot_state: "idle", bot_selected_model: null, bot_reference_url: null })
        .eq("id", profile.id);

      // Генерируем ссылку с параметром u (user id)
      const historyUrl = `https://klex.pro/history?u=${profile.id}`; 
      
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `📂 *Ваша история генераций*\n\nНажмите на ссылку ниже, чтобы просмотреть свои шедевры без лишних входов:\n${historyUrl}`,
          parse_mode: "Markdown",
        }),
      });
      return NextResponse.json({ ok: true });
    }

    // ================== Помощь с ссылкой на юридическую информацию (и отключенным превью) ==================
    if (text === "❓ Помощь") {
      const helpText = 
        `🚀 *Шпаргалка по KLEX.PRO*\n\n` +
        `• *🎨 Создать картинку* — генерация по тексту.\n` +
        `• *🖼 Сгенерировать по фото* — изменение фото.\n` +
        `• *💰 Баланс* — пополнение счета.\n\n` +
        `⚖️ [Публичная оферта](https://telegra.ph/PUBLICHNAYA-OFERTA-03-06-6)\n` +
        `🔒 [Политика конфиденциальности](https://telegra.ph/Politika-konfidencialnosti-03-06-35)`;
      
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: helpText,
          parse_mode: "Markdown",
          link_preview_options: { is_disabled: true },
        }),
      });
      return NextResponse.json({ ok: true });
    }

    if (text === "❓ В чем разница?") {
      const diffText =
        `🤖 *Какую модель выбрать?*\n\n` +
        `Разные задачи требуют разных мощностей. Выбирайте то, что нужно именно вам:\n\n` +
        `🍌 *Nano Banano 2 (5 монет)*\n` +
        `⚡️ Скорость и экономия\n` +
        `Самая быстрая нейросеть для простых задач. Идеально подходит для мемов, стикеров, аниме-артов и быстрых зарисовок. Выдает результат за пару секунд.\n` +
        `👉 Когда выбирать: хотите просто поиграться, проверить идею или сделать забавную картинку для друзей.\n\n` +
        `🍌 *Nano Banana Pro (10 монет)*\n` +
        `🧠 Детализация и интеллект\n` +
        `Продвинутая модель, которая внимательно читает длинные тексты. Отлично справляется со сложной анатомией, правильным светом и мелкими деталями.\n` +
        `👉 Когда выбирать: нужен красивый, проработанный арт или иллюстрация, где важна каждая деталь из вашего описания.\n\n` +
        `🔥 *Nano Banano Pro (4K) (20 монет)*\n` +
        `💎 Бескомпромиссный фотореализм\n` +
        `Вся мощь версии Pro, умноженная на сверхвысокое 4K-разрешение. Кристальная четкость, реалистичная текстура кожи и студийное качество.\n` +
        `👉 Когда выбирать: нужны обои на телефон, фотореалистичный портрет или профессиональное изображение для работы.\n\n` +
        `💡 *Лайфхак:* Проверьте свой промпт на дешевой модели за 5 монет. Если композиция вас устраивает — смело включайте Pro 4K, чтобы превратить набросок в шедевр!`;

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: diffText,
          parse_mode: "Markdown",
          link_preview_options: { is_disabled: true },
        }),
      });

      return NextResponse.json({ ok: true });
    }

    // ⚙️ Настройки
    if (text === "⚙️ Настройки") {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "⚙️ *Настройки*\n\nСкоро здесь можно будет выбрать модель по умолчанию и настроить авто-улучшение лиц.",
          parse_mode: "Markdown",
        }),
      });
      return NextResponse.json({ ok: true });
    }

    // ================== ОБНОВЛЕННАЯ АДМИН ПАНЕЛЬ (Кнопки вместо ссылки) ==================
    if (text === "🔐 Админ-панель" && telegramId === ADMIN_ID) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "🔐 *Панель управления KLEX*\n\nВыберите тип рассылки или посмотрите статистику:",
          parse_mode: "Markdown",
          reply_markup: {
            keyboard: [
              [{ text: "📢 Рассылка в Telegram" }, { text: "📢 Рассылка в MAX" }],
              [{ text: "📊 Статистика пользователей" }],
              [{ text: "⬅️ Назад" }]
            ],
            resize_keyboard: true,
          },
        }),
      });
      return NextResponse.json({ ok: true });
    }

    // --- Логика выбора типа рассылки ---
    if (text === "📢 Рассылка в Telegram" && telegramId === ADMIN_ID) {
      await supabase.from("profiles").update({ bot_state: "awaiting_broadcast_tg" }).eq("id", profile.id);
      await sendMessage(chatId, "📝 *Рассылка: Telegram*\n\nВведите текст сообщения для всех пользователей TG-бота:");
      return NextResponse.json({ ok: true });
    }

    if (text === "📢 Рассылка в MAX" && telegramId === ADMIN_ID) {
      await supabase.from("profiles").update({ bot_state: "awaiting_broadcast_max" }).eq("id", profile.id);
      await sendMessage(chatId, "📝 *Рассылка: MAX*\n\nВведите текст сообщения для всех пользователей в MAX:");
      return NextResponse.json({ ok: true });
    }

    // --- Выполнение рассылки в Telegram ---
    if (currentState === "awaiting_broadcast_tg" && telegramId === ADMIN_ID) {
      await sendMessage(chatId, "🚀 Начинаю рассылку в Telegram...");
      const { data: users } = await supabase.from('profiles').select('telegram_id').not('telegram_id', 'is', null);
      let success = 0;
      if (users) {
        for (const user of users) {
          try {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: user.telegram_id, text: text, parse_mode: "Markdown" }),
            });
            success++;
            await new Promise(res => setTimeout(res, 50));
          } catch (e) { console.error(e); }
        }
      }
      await sendMessage(chatId, `✅ Рассылка в TG завершена!\nУспешно: ${success}`);
      await supabase.from("profiles").update({ bot_state: "idle" }).eq("id", profile.id);
      await sendMainMenu(chatId);
      return NextResponse.json({ ok: true });
    }

    // --- Выполнение рассылки в MAX ---
    if (currentState === "awaiting_broadcast_max" && telegramId === ADMIN_ID) {
      await sendMessage(chatId, "🚀 Начинаю рассылку в MAX...");
      const { data: users } = await supabase.from('profiles').select('max_user_id').not('max_user_id', 'is', null);
      let success = 0;
      if (users) {
        for (const user of users) {
          try {
            await maxBot.api.sendMessageToUser(Number(user.max_user_id), text, { format: 'markdown' });
            success++;
            await new Promise(res => setTimeout(res, 50));
          } catch (e) { console.error(e); }
        }
      }
      await sendMessage(chatId, `✅ Рассылка в MAX завершена!\nУспешно: ${success}`);
      await supabase.from("profiles").update({ bot_state: "idle" }).eq("id", profile.id);
      await sendMainMenu(chatId);
      return NextResponse.json({ ok: true });
    }

    // --- Статистика ---
    if (text === "📊 Статистика пользователей" && telegramId === ADMIN_ID) {
      const { count: tgCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).not('telegram_id', 'is', null);
      const { count: maxCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).not('max_user_id', 'is', null);
      await sendMessage(chatId, `📊 *Статистика*\n\nTelegram: ${tgCount}\nMAX: ${maxCount}`);
      return NextResponse.json({ ok: true });
    }

    // ================== МАШИНА СОСТОЯНИЙ ==================

    // ====== ВЫБОР МОДЕЛИ ДЛЯ ФОТО ======
    if (currentState === "choosing_photo_model") {
      // Проверяем, что текст соответствует одной из моделей (используем MODELS)
      if (!Object.values(MODELS).includes(text)) {
        await sendMessage(chatId, "Пожалуйста, выберите модель из списка.");
        return NextResponse.json({ ok: true });
      }

      // Сохраняем отображаемое имя модели (полное, с ценой)
      await supabase
        .from("profiles")
        .update({
          bot_state: "choosing_photo_format",
          bot_selected_model: text,
        })
        .eq("id", profile.id);

      // Выводим красивые кнопки форматов
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `Модель: *${text}*\n\nВыберите нужный формат для генерации по фото:`,
          parse_mode: "Markdown",
          reply_markup: {
            keyboard: [
              [{ text: "⬛ 1:1 (Квадрат)" }],
              [{ text: "📱 9:16 (Вертикальный)" }, { text: "🖥 16:9 (Горизонтальный)" }],
              [{ text: "⬅️ Назад" }]
            ],
            resize_keyboard: true
          }
        }),
      });

      return NextResponse.json({ ok: true });
    }

    // ====== ВЫБОР ФОРМАТА ДЛЯ ФОТО ======
    if (currentState === "choosing_photo_format") {
      // Определяем формат
      let selectedFormat = "1:1";
      if (text.includes("9:16")) selectedFormat = "9:16";
      else if (text.includes("16:9")) selectedFormat = "16:9";

      // Склеиваем имя модели и формат
      const newModelStr = `${profile.bot_selected_model}|${selectedFormat}`;

      // Переходим в состояние ожидания фото, показываем клавиатуру с кнопками "Готово" и "Назад"
      await supabase
        .from("profiles")
        .update({
          bot_state: "awaiting_photo",
          bot_selected_model: newModelStr,
          bot_reference_url: null, // сбрасываем массив фото перед новым набором
        })
        .eq("id", profile.id);

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `✅ Формат *${selectedFormat}* выбран!\n\nТеперь отправляйте фотографии 📷. Можно отправить несколько. Когда закончите, нажмите "Готово".`,
          parse_mode: "Markdown",
          reply_markup: {
            keyboard: [
              [{ text: "✅ Готово" }],
              [{ text: "⬅️ Назад" }]
            ],
            resize_keyboard: true
          }
        }),
      });

      return NextResponse.json({ ok: true });
    }

    // ====== ОЖИДАЕМ ФОТО (возможна отправка нескольких) ======
    if (currentState === "awaiting_photo") {
      // Обработка кнопки "Готово"
      if (text === "✅ Готово") {
        const currentUrls = profile.bot_reference_url;
        if (!currentUrls || currentUrls.length === 0) {
          await sendMessage(chatId, "Сначала отправьте хотя бы одно фото.");
          return NextResponse.json({ ok: true });
        }

        // Переходим к запросу промпта
        await supabase
          .from("profiles")
          .update({ bot_state: "awaiting_photo_prompt" })
          .eq("id", profile.id);

        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "Теперь напишите описание 🎨",
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: [[{ text: "⬅️ Назад" }]],
              resize_keyboard: true
            }
          }),
        });

        return NextResponse.json({ ok: true });
      }

      // Если прислали фото
      if (photo) {
        const largestPhoto = photo[photo.length - 1];
        const fileId = largestPhoto.file_id;

        const fileRes = await fetch(
          `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`
        );
        const fileData = await fileRes.json();

        const filePath = fileData.result.file_path;
        const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;

        // Добавляем ссылку в массив bot_reference_url
        const currentUrls = profile.bot_reference_url || [];
        const updatedUrls = [...currentUrls, fileUrl];

        await supabase
          .from("profiles")
          .update({ bot_reference_url: updatedUrls })
          .eq("id", profile.id);

        // Подтверждаем получение, клавиатура остаётся прежней
        await sendMessage(chatId, `📸 Фото добавлено (всего ${updatedUrls.length}). Можете добавить ещё или нажать "Готово".`);

        return NextResponse.json({ ok: true });
      }

      // Если прислали любой другой текст, кроме известных кнопок
      if (text && !["✅ Готово"].includes(text)) {
        await sendMessage(chatId, "Пожалуйста, отправьте фотографию или нажмите 'Готово'.");
        return NextResponse.json({ ok: true });
      }

      // Если ничего не подошло (например, пустое сообщение) — игнорируем
      return NextResponse.json({ ok: true });
    }

    // ====== ВЫБОР МОДЕЛИ ДЛЯ ТЕКСТОВОЙ ГЕНЕРАЦИИ ======
    if (currentState === "choosing_model") {
      // Проверяем, что текст соответствует одной из моделей
      if (!Object.values(MODELS).includes(text)) {
        await sendMessage(chatId, "Пожалуйста, выберите модель из списка.");
        return NextResponse.json({ ok: true });
      }

      // Сохраняем отображаемое имя модели
      await supabase
        .from("profiles")
        .update({
          bot_state: "choosing_format",
          bot_selected_model: text,
        })
        .eq("id", profile.id);

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `Модель: *${text}*\n\nВыберите нужный формат изображения:`,
          parse_mode: "Markdown",
          reply_markup: {
            keyboard: [
              [{ text: "⬛ 1:1 (Квадрат)" }],
              [{ text: "📱 9:16 (Вертикальный)" }, { text: "🖥 16:9 (Горизонтальный)" }],
              [{ text: "⬅️ Назад" }]
            ],
            resize_keyboard: true
          }
        }),
      });

      return NextResponse.json({ ok: true });
    }

    // ====== ВЫБОР ФОРМАТА ДЛЯ ТЕКСТА ======
    if (currentState === "choosing_format") {
      let selectedFormat = "1:1";
      if (text.includes("9:16")) selectedFormat = "9:16";
      else if (text.includes("16:9")) selectedFormat = "16:9";

      const newModelStr = `${profile.bot_selected_model}|${selectedFormat}`;

      await supabase
        .from("profiles")
        .update({
          bot_state: "awaiting_prompt",
          bot_selected_model: newModelStr
        })
        .eq("id", profile.id);

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `✅ Формат *${selectedFormat}* выбран!\n\nНапишите, что нужно создать ✍️`,
          parse_mode: "Markdown",
          reply_markup: {
            keyboard: [[{ text: "⬅️ Назад" }]],
            resize_keyboard: true
          }
        }),
      });

      return NextResponse.json({ ok: true });
    }

    // ====== ОЖИДАНИЕ ПРОМПТА (ТЕКСТ) ======
    if (currentState === "awaiting_prompt") {
      if (!text) {
        await sendMessage(chatId, "Пожалуйста, отправьте текстовое описание ✍️");
        return NextResponse.json({ ok: true });
      }

      const savedModel = profile.bot_selected_model || `${MODELS.NANO2}|1:1`;
      const [modelDisplayName] = savedModel.split('|');
      const cost = PRICES[modelDisplayName] || 5;

      if (profile.balance < cost) {
        await sendMessage(
          chatId,
          `❌ Недостаточно средств.\n\nВы выбрали модель за ${cost} 🍌, а у вас всего ${profile.balance} 🍌.\n\nПополните баланс в меню или выберите модель дешевле.`
        );

        await supabase
          .from("profiles")
          .update({ bot_state: "idle", bot_selected_model: null, bot_reference_url: null })
          .eq("id", profile.id);

        return NextResponse.json({ ok: true });
      }

      await sendMessage(chatId, "🎨 Генерация запущена...");

      const [modelDisplayNameForGen, formatFromDb] = savedModel.split('|');
      const modelId = MODEL_NAME_TO_ID[modelDisplayNameForGen];
      const detectedRatio = extractAspectRatio(text);
      const finalRatio = detectedRatio !== "1:1" ? detectedRatio : (formatFromDb || "1:1");

      try {
        const result = await generateImageCore({
          userId: profile.id,
          prompt: text,
          modelId: modelId,
          aspectRatio: finalRatio,
          supabase,
          imageBuffers: undefined
        });

        console.log("SENDING PHOTO:", result.imageUrl);
        
        await sendPhotoBuffer(chatId, result.imageUrl);
        await sendDocumentBuffer(chatId, result.imageUrl);
        
        console.log("PHOTO AND DOCUMENT SENT");

        await supabase
          .from("profiles")
          .update({ bot_state: "idle", bot_selected_model: null, bot_reference_url: null })
          .eq("id", profile.id);
        await sendMainMenu(chatId);

      } catch (error: any) {
        console.error("GENERATION ERROR:", error);

        // ВОЗВРАТ СРЕДСТВ:
        await supabase.rpc('increment_balance', { 
          user_id: profile.id, 
          amount_to_add: cost
        });

        const friendlyError = "Хьюстон, у нас фильтры! 🛑 ИИ посчитал этот запрос или фото небезопасным. Попробуй изменить описание — бананы мы тебе вернули!";
        await sendMessage(chatId, friendlyError);

        await supabase
          .from("profiles")
          .update({ bot_state: "idle", bot_selected_model: null, bot_reference_url: null })
          .eq("id", profile.id);
        await sendMainMenu(chatId);
      }

      return NextResponse.json({ ok: true });
    }

    // ====== ОЖИДАНИЕ ПРОМПТА ПОСЛЕ ФОТО ======
    if (currentState === "awaiting_photo_prompt") {
      if (!text) {
        await sendMessage(chatId, "Пожалуйста, отправьте текстовое описание для фото ✍️");
        return NextResponse.json({ ok: true });
      }

      const savedModel = profile.bot_selected_model || `${MODELS.NANO2}|1:1`;
      const [modelDisplayName] = savedModel.split('|');
      const cost = PRICES[modelDisplayName] || 5;

      if (profile.balance < cost) {
        await sendMessage(
          chatId,
          `❌ Недостаточно средств.\n\nВы выбрали модель за ${cost} 🍌, а у вас всего ${profile.balance} 🍌.\n\nПополните баланс в меню или выберите модель дешевле.`
        );

        await supabase
          .from("profiles")
          .update({ bot_state: "idle", bot_selected_model: null, bot_reference_url: null })
          .eq("id", profile.id);

        return NextResponse.json({ ok: true });
      }

      // Проверяем наличие фото
      const referenceUrls = profile.bot_reference_url;
      if (!referenceUrls || referenceUrls.length === 0) {
        await sendMessage(chatId, "Ошибка: не найдено ни одного фото. Начните заново.");
        await supabase
          .from("profiles")
          .update({ bot_state: "idle", bot_reference_url: null })
          .eq("id", profile.id);
        await sendMainMenu(chatId);
        return NextResponse.json({ ok: true });
      }

      await sendMessage(chatId, "🎨 Генерация по фото запущена...");

      const [modelDisplayNameForGen, formatFromDb] = savedModel.split('|');
      const modelId = MODEL_NAME_TO_ID[modelDisplayNameForGen];
      const detectedRatio = extractAspectRatio(text);
      const finalRatio = detectedRatio !== "1:1" ? detectedRatio : (formatFromDb || "1:1");

      try {
        const imageBuffers = await fetchImageBuffers(referenceUrls);

        const result = await generateImageCore({
          userId: profile.id,
          prompt: text,
          modelId: modelId,
          aspectRatio: finalRatio,
          supabase,
          imageBuffers,
        });

        await sendPhotoBuffer(chatId, result.imageUrl);
        await sendDocumentBuffer(chatId, result.imageUrl);

        await supabase
          .from("profiles")
          .update({ bot_state: "idle", bot_selected_model: null, bot_reference_url: null })
          .eq("id", profile.id);
        await sendMainMenu(chatId);

      } catch (error: any) {
        console.error("PHOTO GENERATION ERROR:", error);

        await supabase.rpc('increment_balance', { 
          user_id: profile.id, 
          amount_to_add: cost
        });

        const friendlyError = "Хьюстон, у нас фильтры! 🛑 ИИ посчитал этот запрос или фото небезопасным. Попробуй изменить описание — бананы мы тебе вернули!";
        await sendMessage(chatId, friendlyError);

        await supabase
          .from("profiles")
          .update({ bot_state: "idle", bot_selected_model: null, bot_reference_url: null })
          .eq("id", profile.id);
        await sendMainMenu(chatId);
      }

      return NextResponse.json({ ok: true });
    }

    // ====== СОСТОЯНИЕ ОЖИДАНИЯ EMAIL (НОВОЕ) ======
    if (currentState === "awaiting_payment_email") {
      // Проверяем, что введённый текст похож на email
      const email = text?.trim();
      if (!email || !email.includes('@') || !email.includes('.')) {
        await sendMessage(chatId, "❌ Пожалуйста, введите корректный email (например, example@domain.com).");
        return NextResponse.json({ ok: true });
      }

      // Сохраняем email в bot_selected_model (временно)
      await supabase
        .from("profiles")
        .update({
          bot_state: "awaiting_payment_amount",
          bot_selected_model: email, // сохраняем email
        })
        .eq("id", profile.id);

      // Запрашиваем сумму
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: "Введите сумму пополнения в рублях ✍️\n(Например: 100, 200 или 500)",
          reply_markup: {
            keyboard: [[{ text: "⬅️ Назад" }]],
            resize_keyboard: true,
          },
        }),
      });

      return NextResponse.json({ ok: true });
    }

    // ====== СОСТОЯНИЕ ОЖИДАНИЯ СУММЫ ПОПОЛНЕНИЯ ======
    if (currentState === "awaiting_payment_amount") {
      const amount = parseInt(text || "");
      
      if (isNaN(amount) || amount < 100) {
        await sendMessage(chatId, "❌ Минимальная сумма пополнения — 100 рублей.");
        return NextResponse.json({ ok: true });
      }

      // Получаем сохранённый email из bot_selected_model
      const userEmail = profile.bot_selected_model;
      if (!userEmail) {
        // Если email почему-то не сохранился, возвращаем к его вводу
        await supabase
          .from("profiles")
          .update({ bot_state: "awaiting_payment_email", bot_selected_model: null })
          .eq("id", profile.id);
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: "Пожалуйста, введите ваш email заново:",
            reply_markup: {
              keyboard: [[{ text: "⬅️ Назад" }]],
              resize_keyboard: true,
            },
          }),
        });
        return NextResponse.json({ ok: true });
      }

      // Вызываем ТВОЙ существующий API оплаты (как на сайте)
      const paymentResponse = await fetch(`${SITE_URL}/api/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          telegramUserId: telegramId,
          email: userEmail, // передаём email
        }),
      });

      const paymentData = await paymentResponse.json();

      if (!paymentResponse.ok || !paymentData.confirmationUrl) {
        console.error("Payment API error:", paymentData);
        await sendMessage(chatId, "❌ Ошибка создания платежа. Попробуйте позже.");
        return NextResponse.json({ ok: true });
      }

      const confirmationUrl = paymentData.confirmationUrl;

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `💳 Пополнение на ${amount} ₽`,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "🔗 Перейти к оплате",
                  url: confirmationUrl
                }
              ]
            ]
          }
        }),
      });

      // Сбрасываем состояние и временные данные
      await supabase
        .from("profiles")
        .update({ bot_state: "idle", bot_selected_model: null })
        .eq("id", profile.id);

      return NextResponse.json({ ok: true });
    }

    // Состояние idle – неизвестная команда
    await sendMessage(chatId, "Неизвестная команда. Используйте меню.");
    await sendMainMenu(chatId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("GLOBAL ERROR:", err);
    return NextResponse.json({ ok: true });
  }
}