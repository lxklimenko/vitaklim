// app/api/download/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const fileUrl = searchParams.get('url');

  if (!fileUrl) {
    return new NextResponse("URL файла не указан", { status: 400 });
  }

  try {
    // 1. Твой сервер (Vercel) сам скачивает файл из Supabase. 
    // Ему VPN не нужен, у него прямой и быстрый канал.
    const response = await fetch(fileUrl);

    if (!response.ok) {
      throw new Error(`Ошибка скачивания сервером: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    let extension = 'jpg';
    if (contentType.includes('webp')) extension = 'webp';
    else if (contentType.includes('png')) extension = 'png';

    // 2. Сервер СРАЗУ ЖЕ отдает этот файл пользователю как документ (Stream)
    // Провайдер юзера видит только klex.pro и ничего не блокирует!
    return new NextResponse(response.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="KLEX_Original.${extension}"`,
      },
    });
  } catch (error) {
    console.error("Ошибка проксирования файла:", error);
    return new NextResponse("Ошибка сервера при скачивании файла", { status: 500 });
  }
}