import sharp from "sharp";
import crypto from "crypto";
import { STORAGE_BUCKET } from "@/app/constants/storage";
import OpenAI from "openai";

const GENERATION_COST = parseInt(process.env.GENERATION_COST || "1", 10);
const FETCH_TIMEOUT = 60000; // 60 seconds (оставлен для возможного использования, но в Google-части не применяется)

function generateFileName(userId: string) {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString("hex");
  return `${userId}/${timestamp}-${random}.jpg`;
}

export async function generateImageCore({
  userId,
  prompt,
  modelId,
  aspectRatio,
  supabase,
  imageBuffer
}: {
  userId: string;
  prompt: string;
  modelId: string;
  aspectRatio?: string;
  supabase: any;
  imageBuffer?: Buffer;
}) {
  console.log("START GENERATION:", { userId, prompt, modelId, hasImageBuffer: !!imageBuffer });

  // 🔥 НОВЫЙ БЛОК: Оптимизируем входящее фото СРАЗУ, чтобы не грузить память
  let optimizedImageBuffer = imageBuffer;
  if (imageBuffer) {
    try {
      console.log("SHARP: Оптимизация входного референса...");
      optimizedImageBuffer = await sharp(imageBuffer)
        .resize({ 
          width: 1536, 
          height: 1536, 
          fit: 'inside', 
          withoutEnlargement: true 
        })
        .jpeg({ quality: 80 }) // Сжимаем сильнее для стабильности
        .toBuffer();
      console.log("SHARP: Вес фото уменьшен до", Math.round(optimizedImageBuffer.length / 1024), "KB");
    } catch (e) {
      console.error("SHARP PRE-PROCESS ERROR:", e);
    }
  }

  const startTime = Date.now();

  // 1️⃣ Anti-spam
  const { data: lastGeneration } = await supabase
    .from("generations")
    .select("created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastGeneration?.created_at) {
    const diff = (Date.now() - new Date(lastGeneration.created_at).getTime()) / 1000;
    if (diff < 3) {
      throw new Error("Слишком частые запросы. Подождите 3 секунды.");
    }
  }

  // 2️⃣ Создаём запись со статусом pending
  const { data: processingRecord, error: processingError } = await supabase
    .from("generations")
    .insert({
      user_id: userId,
      prompt,
      status: "pending"
    })
    .select()
    .single();

  if (processingError) {
    console.error("SUPABASE INSERT ERROR:", processingError); // Видим реальную причину
    throw new Error(`Ошибка БД: ${processingError.message}`);
  }

  console.log("PENDING CREATED:", processingRecord.id);

  // Определяем стоимость в зависимости от модели
  const cost = (modelId === "imagen-4-ultra" || modelId === "dall-e-3") ? 5 : GENERATION_COST;

  // 3️⃣ Всегда списываем баланс через RPC
  const { data: rpcResult } = await supabase.rpc("create_generation", {
    p_generation_id: processingRecord.id,
    p_user_id: userId,
    p_cost: cost
  });

  if (!rpcResult?.success) {
    throw new Error(rpcResult?.error || "Не удалось списать средства");
  }
  console.log("BALANCE CHARGED");

  // ------------------- ГЕНЕРАЦИЯ ИЗОБРАЖЕНИЯ -------------------
  let buffer: Buffer;

  if (modelId === "dall-e-3") {
    // OpenAI DALL-E 3
    console.log("CALLING OPENAI API");
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("API ключ OpenAI не настроен");

    const openai = new OpenAI({ apiKey });
    let finalPrompt = prompt;

    // Если есть референсное изображение, используем GPT-4o для его описания
    if (optimizedImageBuffer) {
      const visionResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Опиши это изображение во всех деталях для создания похожего. Верни только описание." },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${optimizedImageBuffer.toString("base64")}` } },
          ],
        }],
      });
      const visualDescription = visionResponse.choices[0]?.message?.content;
      finalPrompt = `На основе описания: ${visualDescription}. Изменения: ${prompt}`;
    }

    // Динамический выбор размера для DALL-E 3 на основе aspectRatio
    let dallESize: "1024x1024" | "1792x1024" | "1024x1792" = "1024x1024";
    if (aspectRatio === "16:9" || aspectRatio === "21:9") dallESize = "1792x1024";
    else if (aspectRatio === "9:16") dallESize = "1024x1792";

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: finalPrompt,
      n: 1,
      size: dallESize,
      response_format: "b64_json",
    });

    const base64Image = response?.data?.[0]?.b64_json;
    if (!base64Image) throw new Error("OpenAI не вернул изображение");
    buffer = Buffer.from(base64Image, "base64");
    console.log("OPENAI RESPONSE RECEIVED");
  } else {
    // 🌐 ГЕНЕРАЦИЯ ЧЕРЕЗ GOOGLE (Nano, Pro, Ultra)
    console.log("CALLING GOOGLE API");
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API key не настроен");

    const isProModel = modelId === "gemini-3-pro-image-preview" || modelId === "imagen-4-ultra";

    // 1️⃣ Формируем части запроса
    const parts: any[] = [{ text: prompt }];

    if (optimizedImageBuffer) {
      // Используем уже готовую оптимизированную версию
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: optimizedImageBuffer.toString("base64")
        }
      });
    }

    // 2️⃣ СЕКРЕТНЫЙ КОНФИГ: Форсируем максимальное разрешение и ослабляем фильтры безопасности
    const requestBody = {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ["image"],
        ...(aspectRatio && { 
          imageConfig: { 
            aspectRatio: aspectRatio.replace(/\s/g, ''), 
          } 
        }),
        temperature: isProModel ? 0.35 : 0.7,
      },
      // 🚨 Ослабляем фильтры, чтобы модель выдавала 4MP без цензурных тормозов
      safetySettings: [
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
      ]
    };

    // 3️⃣ Вызов API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      }
    );
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Ошибка генерации");

    const base64Image = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
    if (!base64Image) throw new Error("Модель не вернула изображение");
    buffer = Buffer.from(base64Image, "base64");
    console.log("GOOGLE RESPONSE RECEIVED");
  }

  // ------------------- ОБРАБОТКА И СОХРАНЕНИЕ -------------------
  // 🚀 ШАГ 4: СУПЕР-ОБРАБОТКА (Smart Upscale для Pro-качества)
  let processedBuffer: Buffer;
  try {
    const isProModel = modelId === "gemini-3-pro-image-preview" || modelId === "imagen-4-ultra";
    
    // Создаем экземпляр sharp для анализа
    let sharpInstance = sharp(buffer);
    const metadata = await sharpInstance.metadata();
//
    // Проверяем: если модель Pro, а разрешение пришло маленькое (менее 1500px по ширине)
    if (isProModel && metadata.width && metadata.width < 2500) {
      console.log(`[UPSCALING] Нативное разрешение ${metadata.width}x${metadata.height}. Формат: ${aspectRatio}`);
      
      // Пытаемся найти формат в промпте, если aspectRatio не передан или равен "1:1"
      let effectiveRatio = aspectRatio || "1:1";
      if (!aspectRatio || aspectRatio === "1:1") {
        const found = prompt.match(/(\d+):(\d+)/);
        if (found) effectiveRatio = `${found[1]}:${found[2]}`;
      }

      const ratioParts = effectiveRatio.split(':').map(Number);
      const wPart = ratioParts[0] || 1;
      const hPart = ratioParts[1] || 1;
      const ratio = wPart / hPart;

      // Целевая площадь для Pro-качества (4.2 миллиона пикселей)
      const targetArea = 4194304; 

      // Вычисляем идеальную ширину: sqrt(Площадь * Пропорция)
      let targetWidth = Math.round(Math.sqrt(targetArea * ratio));
      
      // Ограничиваем максимальную сторону (для стабильности Telegram и Vercel)
      const MAX_SIDE = 2560;
      if (targetWidth > MAX_SIDE) targetWidth = MAX_SIDE;

      console.log(`[UPSCALE] Рассчитанная целевая ширина: ${targetWidth}px (формат ${effectiveRatio})`);

      sharpInstance = sharpInstance
        .resize({ 
          width: targetWidth, 
          kernel: sharp.kernel.lanczos3,
          withoutEnlargement: false 
        })
        .sharpen(1.0, 0.5, 0.2);
    }

    // Финальная упаковка без потерь качества
    processedBuffer = await sharpInstance
      .jpeg({ 
        quality: isProModel ? 100 : 85, 
        chromaSubsampling: isProModel ? '4:4:4' : '4:2:0',
        mozjpeg: true,
        force: true 
      })
      .toBuffer();

    console.log("GENERATION & UPSCALE COMPLETED SUCCESSFULLY");
  } catch (err) {
    console.error("Sharp Processing Error:", err);
    throw new Error("Ошибка улучшения изображения");
  }

  const fileName = generateFileName(userId);

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, processedBuffer, {
      contentType: "image/jpeg",
      cacheControl: "3600"
    });

  if (uploadError) {
    throw new Error("Ошибка сохранения изображения");
  }

  console.log("UPLOADED TO STORAGE:", fileName);

  // Создаём временную ссылку (1 час)
  const { data: signedUrlData, error: signedError } =
    await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(fileName, 60 * 60);

  if (signedError || !signedUrlData?.signedUrl) {
    throw new Error("Не удалось создать signed URL");
  }

  const publicUrl = signedUrlData.signedUrl;

  const generationTime = Date.now() - startTime;

  await supabase
    .from("generations")
    .update({
      status: "completed",
      image_url: publicUrl,
      storage_path: fileName,
      generation_time_ms: generationTime
    })
    .eq("id", processingRecord.id);

  console.log("GENERATION COMPLETED");

  return {
    imageUrl: publicUrl,
    generationId: processingRecord.id
  };
}