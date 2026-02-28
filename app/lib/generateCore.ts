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
    // 🌐 ГЕНЕРАЦИЯ ЧЕРЕЗ GOOGLE (Nano Banano 2, Pro, Ultra)
    console.log("CALLING GOOGLE API");
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API key не настроен");

    const isProModel = modelId === "gemini-3-pro-image-preview" || modelId === "imagen-4-ultra";

    // 1️⃣ Формируем части запроса
    const parts: any[] = [{ text: prompt }];

    if (imageBuffer) {
      // Для Pro-модели отправляем референс в чуть лучшем качестве
      const optimizedRef = await sharp(imageBuffer)
        .resize({ width: 1536, withoutEnlargement: true }) // Увеличили входное разрешение
        .jpeg({ quality: 95 })
        .toBuffer();

      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: optimizedRef.toString("base64")
        }
      });
    }

    // 2️⃣ СЕКРЕТНЫЙ КОНФИГ: Форсируем максимальное разрешение
    const requestBody = {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ["image"],
        // Для Pro-модели мы явно задаем параметры качества
        ...(aspectRatio && { 
          imageConfig: { 
            aspectRatio: aspectRatio.replace(/\s/g, ''), // Чистим пробелы (например, "9 : 16" -> "9:16")
          } 
        }),
        // Понижаем температуру для Pro, чтобы детали были четче
        temperature: isProModel ? 0.35 : 0.7,
      }
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

    // Проверяем: если модель Pro, а разрешение пришло обрезанное (768px или меньше)
    if (isProModel && metadata.width && metadata.width < 1000) {
      console.log(`[UPSCALING] Нативное разрешение ${metadata.width}x${metadata.height} слишком низкое. Исправляем...`);
      
      // Определяем целевую ширину для 4MP в зависимости от формата
      let targetWidth = 2048; // По умолчанию для 1:1
      if (aspectRatio === "9:16") targetWidth = 1152;
      else if (aspectRatio === "16:9") targetWidth = 2048;

      sharpInstance = sharpInstance
        .resize({ 
          width: targetWidth, 
          kernel: sharp.kernel.lanczos3, // Самый четкий математический алгоритм
          withoutEnlargement: false 
        })
        // Добавляем микро-детализацию, чтобы убрать эффект "мыла" после увеличения
        .sharpen({
          sigma: 1.0,  // Радиус четкости
          m1: 0.5,     // Усиление на плоских участках
          j1: 0.2      // Усиление на гранях
        });
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

    console.log("GENERATION & UPSCALE COMPLETED SUCCESSFULY");
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