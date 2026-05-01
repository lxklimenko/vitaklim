import sharp from "sharp";
import crypto from "crypto";
import { STORAGE_BUCKET } from "@/app/constants/storage";
import OpenAI from "openai";
import { syncGeneration, syncProfile } from "@/app/lib/vps-sync";

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
  imageBuffers, // <-- теперь массив
}: {
  userId: string;
  prompt: string;
  modelId: string;
  aspectRatio?: string;
  supabase: any;
  imageBuffers?: Buffer[]; // <-- тип изменён на массив
}) {
  console.log("START GENERATION:", { userId, prompt, modelId, photosCount: imageBuffers?.length || 0 });

  // ========== Обработка суффикса 4K ==========
  const is4KRequested = modelId.endsWith("-4k");
  const cleanModelId = is4KRequested ? modelId.replace(/-4k$/, "") : modelId;

  // 🔥 Оптимизируем ВСЕ входящие фото через Sharp (если они есть)
  let optimizedBuffers: Buffer[] = [];
  if (imageBuffers && imageBuffers.length > 0) {
    try {
      console.log(`SHARP: Оптимизация ${imageBuffers.length} референсов...`);
      optimizedBuffers = await Promise.all(
        imageBuffers.map(buf =>
          sharp(buf)
            .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 75 }) // Чуть ниже качество для экономии места (можно настроить)
            .toBuffer()
        )
      );
      console.log("SHARP: Все фото оптимизированы, общий вес:",
        optimizedBuffers.reduce((acc, b) => acc + b.length, 0) / 1024, "KB");
    } catch (e) {
      console.error("SHARP PRE-PROCESS ERROR:", e);
      // В случае ошибки используем оригиналы (риск, но лучше чем ничего)
      optimizedBuffers = imageBuffers;
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

  // 🔥 Удаляем старые зависшие "pending" записи пользователя
  await supabase
    .from("generations")
    .delete()
    .eq("user_id", userId)
    .eq("status", "pending");

  // 2️⃣ Создаём запись со статусом pending
  const { data: processingRecord, error: processingError } = await supabase
    .from("generations")
    .insert({
      user_id: userId,
      prompt,
      status: "pending",
      model_id: modelId
    })
    .select()
    .single();

  if (processingError) {
    console.error("SUPABASE INSERT ERROR:", processingError);
    throw new Error(`Ошибка БД: ${processingError.message}`);
  }

  console.log("PENDING CREATED:", processingRecord.id);
  await syncGeneration(supabase, processingRecord.id);

  // ========== Определение стоимости ==========
  let cost = 10; // По умолчанию Nano 2

  if (modelId.includes("-4k")) {
    cost = 20; // Nano Banano Pro (4K)
  } else if (modelId === "gemini-3-pro-image-preview") {
    cost = 15; // Nano Banana Pro
  } else if (modelId === "imagen-4-ultra" || modelId === "dall-e-3") {
    cost = 5; // Для Ultra и DALL-E
  }

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
  await syncProfile(supabase, userId);

  // ------------------- ГЕНЕРАЦИЯ ИЗОБРАЖЕНИЯ -------------------
  const isProModel = cleanModelId === "gemini-3-pro-image-preview" || cleanModelId === "imagen-4-ultra";
  let buffer: Buffer;

  if (modelId === "dall-e-3") {
    // OpenAI DALL-E 3 (поддерживает только одно изображение как референс)
    console.log("CALLING OPENAI API");
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("API ключ OpenAI не настроен");

    const openai = new OpenAI({ apiKey });
    let finalPrompt = prompt;

    // Если есть хотя бы одно фото, используем первое для описания
    if (optimizedBuffers.length > 0) {
      const visionResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Опиши это изображение во всех деталях для создания похожего. Верни только описание." },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${optimizedBuffers[0].toString("base64")}` } },
          ],
        }],
      });
      const visualDescription = visionResponse.choices[0]?.message?.content;
      finalPrompt = `На основе описания: ${visualDescription}. Изменения: ${prompt}`;
    }

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
    // 🌐 ГЕНЕРАЦИЯ ЧЕРЕЗ GOOGLE (поддержка нескольких фото)
    console.log("CALLING GOOGLE API WITH MULTIPLE PHOTOS");
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API key не настроен");

    // Формируем массив частей: текстовый промпт + все фото
    const parts: any[] = [{ text: prompt }];

    if (optimizedBuffers.length > 0) {
      optimizedBuffers.forEach(buf => {
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: buf.toString("base64")
          }
        });
      });
    }

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
      safetySettings: [
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
      ]
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${cleanModelId}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      }
    );
   
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Ошибка генерации");

    console.log("GOOGLE RAW RESPONSE:", JSON.stringify(data, null, 2));

    const base64Image = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
    if (!base64Image) throw new Error("Модель не вернула изображение");
    buffer = Buffer.from(base64Image, "base64");
    console.log("GOOGLE RESPONSE RECEIVED");
  }

  // ------------------- ОБРАБОТКА И СОХРАНЕНИЕ -------------------
  // 🚀 Улучшение качества (upscale) для Pro моделей
  let processedBuffer: Buffer;
  try {
    let sharpInstance = sharp(buffer);
   
    if (isProModel) {
      console.log(`[UPSCALE] Режим: ${is4KRequested ? '4K' : 'Pro 2K'}`);
     
      const targetArea = is4KRequested ? 8294400 : 4194304; // 8.3 Мп для 4K, 4.2 Мп для 2K Pro
      const MAX_SIDE = is4KRequested ? 3840 : 2560;

      const metadata = await sharpInstance.metadata();
     
      let effectiveRatio = aspectRatio || "1:1";
      if (!aspectRatio || aspectRatio === "1:1") {
        const found = prompt.match(/(\d+):(\d+)/);
        if (found) effectiveRatio = `${found[1]}:${found[2]}`;
      }

      const ratioParts = effectiveRatio.split(':').map(Number);
      const ratio = (ratioParts[0] || 1) / (ratioParts[1] || 1);

      let targetWidth = Math.round(Math.sqrt(targetArea * ratio));
      if (targetWidth > MAX_SIDE) targetWidth = MAX_SIDE;

      if (metadata.width && metadata.width < targetWidth) {
        console.log(`[UPSCALE] Увеличение с ${metadata.width}px до ${targetWidth}px`);
        sharpInstance = sharpInstance
          .resize({
            width: targetWidth,
            kernel: sharp.kernel.lanczos3,
            withoutEnlargement: false
          })
          .sharpen(is4KRequested ? 1.5 : 1.0, 0.5, 0.2);
      } else {
        console.log(`[UPSCALE] Изображение уже достаточного размера (${metadata.width}px), пропускаем увеличение`);
      }
    }

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

  // ✅ Ждём VPS upload перед тем как использовать VPS URL
  let vpsUploadSuccess = false;

  if (process.env.VPS_SYNC_URL && process.env.VPS_IMAGES_URL) {
    try {
      const vpsRes = await fetch(`${process.env.VPS_SYNC_URL}/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.VPS_SYNC_SECRET}`,
        },
        body: JSON.stringify({
          fileName,
          imageBase64: processedBuffer.toString("base64"),
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (vpsRes.ok) {
        vpsUploadSuccess = true;
        console.log("VPS UPLOAD SUCCESS:", fileName);
      } else {
        const errText = await vpsRes.text();
        console.error("VPS UPLOAD FAILED:", vpsRes.status, errText);
      }
    } catch (err) {
      console.error("VPS image upload failed:", err);
    }
  }

  // Используем VPS URL только если upload прошёл успешно
  let publicUrl: string;

  if (vpsUploadSuccess) {
    publicUrl = `${process.env.VPS_IMAGES_URL}/prompts-images/${fileName}`;
    console.log("USING VPS URL:", publicUrl);
  } else {
    const { data: signedUrlData, error: signedError } =
      await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(fileName, 60 * 60);
    if (signedError || !signedUrlData?.signedUrl) {
      throw new Error("Не удалось создать signed URL");
    }
    publicUrl = signedUrlData.signedUrl;
    console.log("USING SUPABASE FALLBACK URL:", publicUrl);
  }

  const generationTime = Date.now() - startTime;

  await supabase
    .from("generations")
    .update({
      status: "completed",
      image_url: publicUrl,
      storage_path: fileName,
      generation_time_ms: generationTime,
      cost: cost,
      model_id: modelId
    })
    .eq("id", processingRecord.id);
  await syncGeneration(supabase, processingRecord.id);

  console.log("GENERATION COMPLETED");

  return {
    imageUrl: publicUrl,
    generationId: processingRecord.id //х
  };
}
