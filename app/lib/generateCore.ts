import sharp from "sharp";
import crypto from "crypto";
import { STORAGE_BUCKET } from "@/app/constants/storage";
import { createClient } from "@supabase/supabase-js";

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

  console.log("START GENERATION:", { userId, prompt, hasImageBuffer: !!imageBuffer });

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

  // 2️⃣ pending
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

  // Determine cost based on model or if imageBuffer provided (skip charge)
  const cost = imageBuffer ? 0 : (modelId === "imagen-4-ultra" ? 5 : GENERATION_COST);

  // 3️⃣ списание (skip if imageBuffer provided)
  if (!imageBuffer) {
    const { data: rpcResult } = await supabase.rpc("create_generation", {
      p_generation_id: processingRecord.id,
      p_user_id: userId,
      p_cost: cost
    });

    if (!rpcResult?.success) {
      throw new Error(rpcResult?.error || "Не удалось списать средства");
    }
    console.log("BALANCE CHARGED");
  } else {
    console.log("SKIP BALANCE CHARGE (image buffer provided)");
  }

  let buffer: Buffer;

  if (imageBuffer) {
    buffer = imageBuffer;
    console.log("USING PROVIDED IMAGE BUFFER");
  } else {
    // Call Google API
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("API key не настроен");
    }

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["image"],
        ...(aspectRatio && { imageConfig: { aspectRatio } })
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

  // Process image with sharp: ensure JPEG format, optimize quality
  let processedBuffer: Buffer;
  try {
    processedBuffer = await sharp(buffer)
      .jpeg({ quality: 85, mozjpeg: true })
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

  // Create signed URL (valid 1 hour)
  const { data: signedUrlData, error: signedError } =
    await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(fileName, 60 * 60); // 1 hour

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