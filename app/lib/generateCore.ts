import sharp from "sharp";
import crypto from "crypto";
import { STORAGE_BUCKET } from "@/app/constants/storage";
import OpenAI from "openai";

const GENERATION_COST = parseInt(process.env.GENERATION_COST || "1", 10);
const FETCH_TIMEOUT = 60000; // 60 seconds

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
    throw new Error("Не удалось создать запись генерации");
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
    if (imageBuffer) {
      const visionResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Опиши это изображение во всех деталях для создания похожего. Верни только описание." },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBuffer.toString("base64")}` } },
          ],
        }],
      });
      const visualDescription = visionResponse.choices[0]?.message?.content;
      finalPrompt = `На основе описания: ${visualDescription}. Изменения: ${prompt}`;
    }

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: finalPrompt,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
    });

    const base64Image = response?.data?.[0]?.b64_json;
    if (!base64Image) throw new Error("OpenAI не вернул изображение");
    buffer = Buffer.from(base64Image, "base64");
    console.log("OPENAI RESPONSE RECEIVED");
  } else {
    // Google AI (Imagen и др.)
    console.log("CALLING GOOGLE API");
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API key не настроен");

    // Формируем части запроса
    const parts: any[] = [{ text: prompt }];

    // Если есть референсное изображение — добавляем его в parts
    if (imageBuffer) {
      // Оптимизируем референс, чтобы не превысить лимиты
      const optimizedRef = await sharp(imageBuffer)
        .resize({ width: 1024, withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();

      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: optimizedRef.toString("base64")
        }
      });
      console.log("REFERENCE IMAGE ADDED TO GOOGLE REQUEST");
    }

    // 1. Формируем конфиг. Для Pro-модели Google автоматически выдает 
    // более высокое разрешение при указании aspectRatio.
    const requestBody = {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ["image"],
        ...(aspectRatio && { 
          imageConfig: { 
            aspectRatio,
            // Для Pro-модели можно добавить доп. параметры, если API их поддерживает
          } 
        })
      }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        }
      );
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw new Error("Превышено время ожидания ответа от API");
      }
      throw new Error(`Ошибка сети: ${error.message}`);
    }
    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "Ошибка генерации");
    }

    console.log("GOOGLE RESPONSE RECEIVED");

    const base64Image =
      data?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;

    if (!base64Image) {
      throw new Error("Модель не вернула изображение");
    }

    buffer = Buffer.from(base64Image, "base64");
  }

  // ------------------- ОБРАБОТКА И СОХРАНЕНИЕ -------------------
  // Конвертируем в JPEG с оптимизацией
  let processedBuffer: Buffer;
  try {
    // 🚀 Настройка качества в зависимости от модели
    const isPro = modelId === "gemini-3-pro-image-preview" || modelId === "imagen-4-ultra";
    
    processedBuffer = await sharp(buffer)
      .jpeg({ 
        quality: isPro ? 100 : 85, // Для Pro ставим 100% качество
        mozjpeg: true,
        chromaSubsampling: isPro ? '4:4:4' : '4:2:0' // Максимальная цветопередача для Pro
      })
      .toBuffer();
  } catch (err) {
    throw new Error("Ошибка обработки изображения");
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