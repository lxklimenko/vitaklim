import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateImageCore } from "@/app/lib/generateCore";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PAYMENT_PROVIDER_TOKEN = process.env.PAYMENT_PROVIDER_TOKEN!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log("SUPABASE URL:", SUPABASE_URL);
console.log("SERVICE ROLE EXISTS:", !!SUPABASE_SERVICE_ROLE_KEY);

// ==================== ЗОЛОТОЙ СТАНДАРТ НАЗВАНИЙ ====================
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
  | "awaiting_payment_amount";

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

// Обновлённое главное меню с новыми кнопками
async function sendMainMenu(chatId: number) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "Выберите действие:",
      reply_markup: {
        keyboard: [
          [{ text: "🎨 Создать картинку" }, { text: "🖼 Сгенерировать по фото" }],
          [{ text: "💰 Баланс" }, { text: "📜 История" }],
          [{ text: "⚙️ Настройки" }, { text: "❓ Помощь" }],
        ],
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

    // ========== 1. ОБРАБОТКА PRE_CHECKOUT (ПОДТВЕРЖДЕНИЕ ПЛАТЕЖА) ==========
    if (body.pre_checkout_query) {
      console.log("HANDLING PRE_CHECKOUT:", body.pre_checkout_query.id);
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pre_checkout_query_id: body.pre_checkout_query.id,
          ok: true
        }),
      });
      return NextResponse.json({ ok: true });
    }

    // ========== 2. ОБРАБОТКА УСПЕШНОГО ПЛАТЕЖА (до получения message) ==========
    if (body.message?.successful_payment) {
      const payment = body.message.successful_payment;
      const payload = payment.invoice_payload; // 'topup_100_uuid'
      const amount = payment.total_amount / 100; // из копеек в рубли
      const userId = payload.split('_')[2]; // извлекаем userId

      console.log(`💳 PAYMENT SUCCESS: User ${userId}, Amount ${amount}`);

      // Начисляем баланс через RPC (Используем имена, которые помнит кэш Supabase)
      const { error: rpcError } = await supabase.rpc('increment_balance', { 
        user_id: userId,
        amount_to_add: amount
      });

      if (rpcError) {
        console.error("RPC ERROR:", rpcError);
        await sendMessage(body.message.chat.id, "⚠️ Платеж прошёл, но возникла ошибка при начислении. Свяжитесь с поддержкой.");
      } else {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: body.message.chat.id,
            text: `✅ *Оплата прошла успешно!*\n\nНа ваш баланс зачислено ${amount} 🍌.`,
            parse_mode: "Markdown"
          }),
        });
      }
      
      return NextResponse.json({ ok: true });
    }

    // ========== 3. ОБРАБОТКА CALLBACK_QUERY (нажатие inline-кнопок) ==========
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
        await supabase
          .from("profiles")
          .update({ bot_state: "awaiting_payment_amount" })
          .eq("id", cbProfile.id);

        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: cbChatId,
            text: "Введите сумму пополнения в рублях ✍️\n(Например: 100, 200 или 500)",
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
          balance: 50, // Бонус начислится, только если записи не было
          bot_state: "idle",
          bot_selected_model: null,
          bot_reference_url: null,
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

    if (text === "/start") {
      await supabase
        .from("profiles")
        .update({
          bot_state: "idle",
          bot_selected_model: null,
          bot_reference_url: null,
        })
        .eq("id", profile.id);

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
              [{ text: "⬅️ Назад" }],
            ],
            resize_keyboard: true,
          },
        }),
      });

      return NextResponse.json({ ok: true });
    }

    // ================== ИЗМЕНЕНИЕ 1: Баланс с ссылками на оферту и политику ==================
    if (text === "💰 Баланс") {
      await supabase
        .from("profiles")
        .update({ bot_state: "idle", bot_selected_model: null, bot_reference_url: null })
        .eq("id", profile.id);

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `💰 *Ваш баланс:* ${profile.balance} 🍌\n\n` +
                `_Нажимая кнопку «Пополнить», вы принимаете условия_ [Публичной оферты](https://klex.pro/terms) _и_ [Политики конфиденциальности](https://klex.pro/privacy).`,
          parse_mode: "Markdown",
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

    // ================== ИЗМЕНЕНИЕ 3: Помощь с ссылкой на юридическую информацию ==================
    if (text === "❓ Помощь") {
      const helpText = 
        `🚀 *Шпаргалка по KLEX.PRO*\n\n` +
        `• *🎨 Создать картинку* — создание картинки по тексту.\n` +
        `• *🖼 Сгенерировать по фото* — изменение вашего фото или создание похожего.\n` +
        `• *💰 Баланс* — проверка счета и пополнение через ЮKassa.\n\n` +
        `📸 *Как менять формат:* просто напиши в конце запроса \`21:9\`, \`16:9\` или \`9:16\`. Бот сам настроит размер!\n\n` +
        `⚖️ [Юридическая информация и оферта](https://klex.pro/terms)`;
      
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: helpText,
          parse_mode: "Markdown",
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

    if (text === "🚀 Открыть приложение") {
      await supabase
        .from("profiles")
        .update({ bot_state: "idle", bot_selected_model: null, bot_reference_url: null })
        .eq("id", profile.id);

      await sendMessage(
        chatId,
        "Откройте Mini App: https://t.me/YourBotName/app"
      );
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

    // ====== СОСТОЯНИЕ ОЖИДАНИЯ СУММЫ ПОПОЛНЕНИЯ ======
    if (currentState === "awaiting_payment_amount") {
      const amount = parseInt(text || "");
      
      if (isNaN(amount) || amount < 100) {
        await sendMessage(chatId, "❌ Минимальная сумма пополнения — 100 рублей (ограничение платежной системы).");
        return NextResponse.json({ ok: true });
      }

      // ================== ИЗМЕНЕНИЕ 2: Инвойс с ссылкой на условия ==================
      const invoiceResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendInvoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          title: "Пополнение баланса KLEX",
          description: `Зачисление ${amount} 🍌 на аккаунт. Условия: klex.pro/terms`,
          payload: `topup_${amount}_${profile.id}`,
          provider_token: PAYMENT_PROVIDER_TOKEN,
          currency: "RUB",
          prices: [{ label: "Пополнение баланса", amount: Math.floor(amount * 100) }],
          start_parameter: "topup-balance",
        }),
      });

      const invoiceData = await invoiceResponse.json();
      
      if (!invoiceData.ok) {
        console.error("Ошибка выставления счета:", invoiceData);
        await sendMessage(chatId, `❌ Ошибка: ${invoiceData.description}`);
        return NextResponse.json({ ok: true });
      }

      await supabase
        .from("profiles")
        .update({ bot_state: "idle" })
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