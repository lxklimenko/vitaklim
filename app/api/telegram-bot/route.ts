import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateImageCore } from "@/app/lib/generateCore";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
  | "awaiting_photo_prompt";

/**
 * Ищет в тексте формат (например, 21:9, 9 на 16 или 1:1).
 * Теперь поддерживает панорамный режим 21:9.
 */
function extractAspectRatio(text: string): string {
  // 1. Улучшенный поиск: понимает ":" "на" "x" и пробелы (например, "21 на 9")
  const ratioRegex = /(\d{1,2})[:\sнаx]+(\d{1,2})/;
  const match = text.match(ratioRegex);
  
  // 2. Добавляем 21:9 в список разрешенных
  const supportedRatios = ['1:1', '9:16', '16:9', '4:3', '3:4', '2:3', '3:2', '21:9'];
  
  if (match) {
    const foundRatio = `${match[1]}:${match[2]}`;
    if (supportedRatios.includes(foundRatio)) {
      return foundRatio;
    }
  }
  
  return "1:1"; // Если ничего не найдено, возвращаем квадрат
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
  // скачиваем файл с signed URL
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
    "nano_banano_result.jpg" // Имя файла, которое увидит пользователь
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

    const message = body.message;
    if (!message) return NextResponse.json({ ok: true });

    const chatId = message.chat.id;
    const telegramId = message.from.id;
    const username = message.from.username || `telegram_${telegramId}`;
    const text = message.text;
    const photo = message.photo; // может быть undefined

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

    // Состояние хранится в БД
    const currentState = profile.bot_state ?? "idle";
    const selectedModel = profile.bot_selected_model;

    // ================== ОБРАБОТКА КОМАНД ==================

    // /start
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

    // 🎨 Сгенерировать (обновлённое меню с новой кнопкой)
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
              [{ text: "🍌 Nano Banana Pro (Gemini 3 Pro)" }], // 👈 Новая кнопка
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

    // 🖼 По фото
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
              [{ text: "🍌 Nano Banana Pro (Gemini 3 Pro)" }], // 👈 Новая кнопка
              [{ text: "💎 Ultra (5 кредитов)" }],
              [{ text: "⬅️ Назад" }],
            ],
            resize_keyboard: true,
          },
        }),
      });

      return NextResponse.json({ ok: true });
    }

    // 💰 Баланс (расширенная версия с Markdown и кнопкой)
    if (text === "💰 Баланс") {
      // 1. Сбрасываем состояние, чтобы пользователь не "застрял" в ожидании промпта
      await supabase
        .from("profiles")
        .update({ 
          bot_state: "idle", 
          bot_selected_model: null, 
          bot_reference_url: null 
        })
        .eq("id", profile.id);

      // 2. Формируем красивое сообщение с использованием Markdown
      const balanceMessage = 
        `💳 *Личный кабинет*\n\n` +
        `👤 Пользователь: @${username.replace(/_/g, '\\_')}\n` +
        `💰 *Ваш баланс:* ${profile.balance} 🍌\n\n` +
        `💡 _1 генерация Nano Banana Pro = 1 🍌_\n` +
        `💎 _1 генерация Ultra = 5 🍌_`;

      // 3. Отправляем сообщение с поддержкой разметки Markdown
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: balanceMessage,
          parse_mode: "Markdown", // Позволяет делать текст жирным и курсивом
          reply_markup: {
            inline_keyboard: [
              [{ text: "⚡️ Пополнить баланс", url: "https://klex.pro/pricing" }] // Ссылка на твой сайт
            ]
          }
        }),
      });

      return NextResponse.json({ ok: true });
    }

    // 🚀 Открыть приложение
    if (text === "🚀 Открыть приложение") {
      await supabase
        .from("profiles")
        .update({ bot_state: "idle", bot_selected_model: null, bot_reference_url: null })
        .eq("id", profile.id);

      await sendMessage(
        chatId,
        "Откройте Mini App: https://t.me/YourBotName/app" // замените на реальную ссылку
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

      // 👇 Новая обработка для Pro-модели
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

    // Состояние: выбор модели (для обычной генерации)
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

      // 👇 Новая обработка для Pro-модели
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

    // Состояние: ожидание промпта (для обычной генерации)
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

        // Обязательно сбрасываем состояние даже при ошибке
        await supabase
          .from("profiles")
          .update({ bot_state: "idle", bot_selected_model: null, bot_reference_url: null })
          .eq("id", profile.id);

        // Если бы у нас был ID генерации, мы могли бы пометить запись как failed
        // await supabase.from("generations").update({ status: "failed" }).eq("id", generationId);
      }

      return NextResponse.json({ ok: true });
    }

    // Состояние: ожидание промпта после получения фото
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

        // Обязательно сбрасываем состояние даже при ошибке
        await supabase
          .from("profiles")
          .update({ bot_state: "idle", bot_selected_model: null, bot_reference_url: null })
          .eq("id", profile.id);

        // Если бы у нас был ID генерации, мы могли бы пометить запись как failed
        // await supabase.from("generations").update({ status: "failed" }).eq("id", generationId);
      }

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