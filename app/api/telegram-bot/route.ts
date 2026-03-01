import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateImageCore } from "@/app/lib/generateCore";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PAYMENT_PROVIDER_TOKEN = process.env.PAYMENT_PROVIDER_TOKEN!; // ДОБАВЛЕНО

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log("SUPABASE URL:", SUPABASE_URL);
console.log("SERVICE ROLE EXISTS:", !!SUPABASE_SERVICE_ROLE_KEY);

// Типы состояний бота (для документации)
type UserState =
  | "idle"
  | "choosing_model"
  | "choosing_photo_model"
  | "awaiting_prompt"
  | "awaiting_photo"
  | "awaiting_photo_prompt"
  | "awaiting_payment_amount"; // ДОБАВЛЕНО

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

async function sendMainMenu(chatId: number) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "Выберите действие:",
      reply_markup: {
        keyboard: [
          [{ text: "🎨 Сгенерировать" }, { text: "🖼 По фото" }],
          [{ text: "💰 Баланс" }, { text: "🚀 Открыть приложение" }],
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("UPDATE:", body);

    // ========== Обработка callback_query (нажатие inline-кнопки) ==========
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
            text: "Введите сумму пополнения в рублях ✍️\n(Например: 55, 100 или 500)",
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

    const message = body.message;
    if (!message) return NextResponse.json({ ok: true });

    const chatId = message.chat.id;
    const telegramId = message.from.id;
    const username = message.from.username || `telegram_${telegramId}`;
    const text = message.text;
    const photo = message.photo;

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

      const { data: newProfile, error } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          telegram_id: telegramId,
          telegram_username: username,
          balance: 0,
          bot_state: "idle",
          bot_selected_model: null,
          bot_reference_url: null,
        })
        .select()
        .single();

      if (error) {
        console.error("PROFILE INSERT ERROR:", error);
        return NextResponse.json({ ok: true });
      }

      profile = newProfile;
    }

    const currentState = profile.bot_state ?? "idle";
    const selectedModel = profile.bot_selected_model;

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

    if (text === "🎨 Сгенерировать") {
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
              [{ text: "🍌 Nano Banano 2 (Gemini 3.1 Flash)" }],
              [{ text: "🍌 Nano Banana Pro (Gemini 3 Pro)" }],
              [{ text: "💎 Ultra (5 кредитов)" }],
              [{ text: "🪄 GPT Image - ИИ фотошоп от OpenAI" }],
              [{ text: "⬅️ Назад" }],
            ],
            resize_keyboard: true,
          },
        }),
      });

      return NextResponse.json({ ok: true });
    }

    if (text === "🖼 По фото") {
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
              [{ text: "🍌 Nano Banano 2 (Gemini 3.1 Flash)" }],
              [{ text: "🍌 Nano Banana Pro (Gemini 3 Pro)" }],
              [{ text: "💎 Ultra (5 кредитов)" }],
              [{ text: "⬅️ Назад" }],
            ],
            resize_keyboard: true,
          },
        }),
      });

      return NextResponse.json({ ok: true });
    }

    // ИСПРАВЛЕННЫЙ БЛОК: "💰 Баланс" с inline-кнопкой и улучшенным текстом
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
          text: `💰 *Ваш баланс:* ${profile.balance} 🍌\n\n_Нажмите кнопку ниже, чтобы пополнить счет на любую сумму_`,
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [[{ text: "💳 Пополнить баланс", callback_data: "start_payment" }]]
          },
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
      if (text === "🍌 Nano Banano 2 (Gemini 3.1 Flash)") {
        await supabase
          .from("profiles")
          .update({
            bot_state: "awaiting_photo",
            bot_selected_model: "gemini-3.1-flash-image-preview",
          })
          .eq("id", profile.id);

        await sendMessage(
          chatId,
          "Создавайте и редактируйте изображения прямо в чате.\nГотовы начать?\nОтправьте фотографию 📷"
        );
        return NextResponse.json({ ok: true });
      }

      if (text === "🍌 Nano Banana Pro (Gemini 3 Pro)") {
        await supabase
          .from("profiles")
          .update({
            bot_state: "awaiting_photo",
            bot_selected_model: "gemini-3-pro-image-preview",
          })
          .eq("id", profile.id);

        await sendMessage(
          chatId,
          "Выбрана Nano Banana Pro 🚀\n" +
          "Это профессиональная модель для сложных задач.\n\n" +
          "Отправьте фотографию 📷"
        );
        return NextResponse.json({ ok: true });
      }

      if (text === "💎 Ultra (5 кредитов)") {
        await supabase
          .from("profiles")
          .update({
            bot_state: "awaiting_photo",
            bot_selected_model: "imagen-4-ultra",
          })
          .eq("id", profile.id);

        await sendMessage(chatId, "Отправьте фотографию 📷");
        return NextResponse.json({ ok: true });
      }

      if (text === "⬅️ Назад") {
        await supabase
          .from("profiles")
          .update({
            bot_state: "idle",
            bot_selected_model: null,
            bot_reference_url: null,
          })
          .eq("id", profile.id);

        await sendMainMenu(chatId);
        return NextResponse.json({ ok: true });
      }

      await sendMessage(chatId, "Пожалуйста, выберите модель из списка.");
      return NextResponse.json({ ok: true });
    }

    // ====== ОЖИДАЕМ ФОТО ======
    if (currentState === "awaiting_photo") {
      if (!photo) {
        await sendMessage(chatId, "Пожалуйста, отправьте фотографию 📷");
        return NextResponse.json({ ok: true });
      }

      const largestPhoto = photo[photo.length - 1];
      const fileId = largestPhoto.file_id;

      const fileRes = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`
      );
      const fileData = await fileRes.json();

      const filePath = fileData.result.file_path;
      const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;

      await supabase
        .from("profiles")
        .update({
          bot_state: "awaiting_photo_prompt",
          bot_selected_model: profile.bot_selected_model,
          bot_reference_url: fileUrl,
        })
        .eq("id", profile.id);

      await sendMessage(chatId, "Теперь напишите описание 🎨");
      return NextResponse.json({ ok: true });
    }

    // ====== ВЫБОР МОДЕЛИ ДЛЯ ТЕКСТОВОЙ ГЕНЕРАЦИИ ======
    if (currentState === "choosing_model") {
      if (text === "🍌 Nano Banano 2 (Gemini 3.1 Flash)") {
        await supabase
          .from("profiles")
          .update({
            bot_state: "awaiting_prompt",
            bot_selected_model: "gemini-3.1-flash-image-preview",
            bot_reference_url: null,
          })
          .eq("id", profile.id);

        await sendMessage(
          chatId,
          "Создавайте и редактируйте изображения прямо в чате.\nГотовы начать?\nНапишите в чат, что нужно создать"
        );
        return NextResponse.json({ ok: true });
      }

      if (text === "🍌 Nano Banana Pro (Gemini 3 Pro)") {
        await supabase
          .from("profiles")
          .update({
            bot_state: "awaiting_prompt",
            bot_selected_model: "gemini-3-pro-image-preview",
            bot_reference_url: null,
          })
          .eq("id", profile.id);

        await sendMessage(
          chatId,
          "Выбрана Nano Banana Pro 🚀\n" +
          "Это профессиональная модель для сложных задач.\n\n" +
          "Напишите, что нужно создать ✍️"
        );
        return NextResponse.json({ ok: true });
      }

      if (text === "💎 Ultra (5 кредитов)") {
        await supabase
          .from("profiles")
          .update({
            bot_state: "awaiting_prompt",
            bot_selected_model: "imagen-4-ultra",
            bot_reference_url: null,
          })
          .eq("id", profile.id);

        await sendMessage(chatId, "Опишите изображение для Ultra 💎");
        return NextResponse.json({ ok: true });
      }

      if (text === "🪄 GPT Image - ИИ фотошоп от OpenAI") {
        await supabase
          .from("profiles")
          .update({
            bot_state: "awaiting_prompt",
            bot_selected_model: "dall-e-3",
            bot_reference_url: null,
          })
          .eq("id", profile.id);

        await sendMessage(chatId, "Опишите изображение для GPT Image 🪄");
        return NextResponse.json({ ok: true });
      }

      if (text === "⬅️ Назад") {
        await supabase
          .from("profiles")
          .update({
            bot_state: "idle",
            bot_selected_model: null,
            bot_reference_url: null,
          })
          .eq("id", profile.id);

        await sendMainMenu(chatId);
        return NextResponse.json({ ok: true });
      }

      await sendMessage(chatId, "Пожалуйста, выберите модель из списка.");
      return NextResponse.json({ ok: true });
    }

    // ====== ОЖИДАНИЕ ПРОМПТА (ТЕКСТОВАЯ ГЕНЕРАЦИЯ) ======
    if (currentState === "awaiting_prompt") {
      if (!text) {
        await sendMessage(chatId, "Пожалуйста, отправьте текстовое описание ✍️");
        return NextResponse.json({ ok: true });
      }

      if (profile.balance <= 0) {
        await sendMessage(
          chatId,
          "❌ Недостаточно средств.\n\nПополни баланс в Mini App."
        );

        await supabase
          .from("profiles")
          .update({ bot_state: "idle", bot_selected_model: null, bot_reference_url: null })
          .eq("id", profile.id);

        return NextResponse.json({ ok: true });
      }

      await sendMessage(chatId, "🎨 Генерация запущена...");

      const modelId = selectedModel || "gemini-3.1-flash-image-preview";

      try {
        const detectedRatio = extractAspectRatio(text);

        const result = await generateImageCore({
          userId: profile.id,
          prompt: text,
          modelId,
          aspectRatio: detectedRatio,
          supabase,
        });

        console.log("SENDING PHOTO:", result.imageUrl);
        
        await sendPhotoBuffer(chatId, result.imageUrl);
        await sendDocumentBuffer(chatId, result.imageUrl);
        
        console.log("PHOTO AND DOCUMENT SENT");

        await supabase
          .from("profiles")
          .update({ bot_state: "idle", bot_selected_model: null, bot_reference_url: null })
          .eq("id", profile.id);
      } catch (error: any) {
        console.error("GENERATION ERROR:", error);
        await sendMessage(chatId, `❌ Ошибка генерации:\n${error.message}`);

        await supabase
          .from("profiles")
          .update({ bot_state: "idle", bot_selected_model: null, bot_reference_url: null })
          .eq("id", profile.id);
      }

      return NextResponse.json({ ok: true });
    }

    // ====== ОЖИДАНИЕ ПРОМПТА ПОСЛЕ ФОТО ======
    if (currentState === "awaiting_photo_prompt") {
      if (!text) {
        await sendMessage(chatId, "Пожалуйста, отправьте текстовое описание для фото ✍️");
        return NextResponse.json({ ok: true });
      }

      if (!profile.bot_reference_url) {
        await sendMessage(chatId, "Ошибка: фото не найдено.");
        return NextResponse.json({ ok: true });
      }

      if (profile.balance <= 0) {
        await sendMessage(
          chatId,
          "❌ Недостаточно средств.\n\nПополни баланс в Mini App."
        );

        await supabase
          .from("profiles")
          .update({ bot_state: "idle", bot_selected_model: null, bot_reference_url: null })
          .eq("id", profile.id);

        return NextResponse.json({ ok: true });
      }

      await sendMessage(chatId, "🎨 Генерация по фото запущена...");

      try {
        const imageResponse = await fetch(profile.bot_reference_url);
        const imageArrayBuffer = await imageResponse.arrayBuffer();
        const imageBuffer = Buffer.from(imageArrayBuffer);

        const detectedRatio = extractAspectRatio(text);

        const result = await generateImageCore({
          userId: profile.id,
          prompt: text,
          modelId: profile.bot_selected_model || "imagen-4-ultra",
          aspectRatio: detectedRatio,
          supabase,
          imageBuffer
        });

        await sendPhotoBuffer(chatId, result.imageUrl);
        await sendDocumentBuffer(chatId, result.imageUrl);

        await supabase
          .from("profiles")
          .update({ bot_state: "idle", bot_selected_model: null, bot_reference_url: null })
          .eq("id", profile.id);

      } catch (error: any) {
        console.error("PHOTO GENERATION ERROR:", error);
        await sendMessage(chatId, `❌ Ошибка генерации:\n${error.message}`);

        await supabase
          .from("profiles")
          .update({ bot_state: "idle", bot_selected_model: null, bot_reference_url: null })
          .eq("id", profile.id);
      }

      return NextResponse.json({ ok: true });
    }

    // ====== СОСТОЯНИЕ ОЖИДАНИЯ СУММЫ ПОПОЛНЕНИЯ ======
    if (currentState === "awaiting_payment_amount") {
      const amount = parseInt(text || "");
      
      if (isNaN(amount) || amount < 10) {
        await sendMessage(chatId, "❌ Пожалуйста, введите корректное число (минимум 10 рублей).");
        return NextResponse.json({ ok: true });
      }

      // Генерируем инвойс
      const invoiceResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendInvoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          title: "Пополнение баланса KLEX",
          description: `Зачисление ${amount} бананов 🍌 на ваш аккаунт`,
          payload: `topup_${amount}_${profile.id}`,
          provider_token: PAYMENT_PROVIDER_TOKEN,
          currency: "RUB",
          prices: [{ label: "Пополнение баланса", amount: amount * 100 }],
          start_parameter: "topup-balance",
        }),
      });

      const invoiceData = await invoiceResponse.json();
      console.log("INVOICE SENT:", invoiceData);

      // Сбрасываем состояние в idle
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