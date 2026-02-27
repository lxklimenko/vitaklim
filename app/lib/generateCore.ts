import sharp from "sharp";
import crypto from "crypto";
import { STORAGE_BUCKET } from "@/app/constants/storage";
import { createClient } from "@supabase/supabase-js";

const GENERATION_COST = parseInt(process.env.GENERATION_COST || "1", 10);
const FETCH_TIMEOUT = 60000;

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
  supabase
}: {
  userId: string;
  prompt: string;
  modelId: string;
  aspectRatio?: string;
  supabase: any;
}) {

  console.log("START GENERATION:", { userId, prompt });

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

  const cost = modelId === "imagen-4-ultra" ? 5 : GENERATION_COST;

  // 3️⃣ списание
  const { data: rpcResult } = await supabase.rpc("create_generation", {
    p_generation_id: processingRecord.id,
    p_user_id: userId,
    p_cost: cost
  });

  if (!rpcResult?.success) {
    throw new Error(rpcResult?.error || "Не удалось списать средства");
  }

  console.log("BALANCE CHARGED");

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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    }
  );

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

  const buffer = Buffer.from(base64Image, "base64");
  const fileName = generateFileName(userId);

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, buffer, { contentType: "image/jpeg" });

  if (uploadError) {
    throw new Error("Ошибка сохранения изображения");
  }

  console.log("UPLOADED TO STORAGE:", fileName);

  // 🔁 Заменяем public URL на signed URL (действителен 1 час)
  const { data: signedUrlData, error: signedError } =
    await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(fileName, 60 * 60); // 1 час

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