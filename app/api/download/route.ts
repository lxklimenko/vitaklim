import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get('file'); 

  if (!filePath) {
    return new NextResponse("Параметр 'file' не указан", { status: 400 });
  }

  try {
    // Декодируем путь на случай спецсимволов
    const decodedPath = decodeURIComponent(filePath);

    // Скачиваем файл напрямую через админ-доступ (VPN не нужен)
    const { data, error } = await supabaseAdmin.storage
      .from('generations-private')
      .download(decodedPath);

    if (error || !data) {
      console.error("Supabase Storage Error:", error);
      return new NextResponse("Файл не найден в хранилище", { status: 404 });
    }

    const buffer = await data.arrayBuffer();
    const contentType = data.type || 'image/jpeg';
    
    // Определяем расширение для красивого имени
    const ext = contentType.includes('png') ? 'png' : 'jpg';

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="KLEX_Original_${Date.now()}.${ext}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (e) {
    console.error("Proxy Download Error:", e);
    return new NextResponse("Внутренняя ошибка сервера", { status: 500 });
  }
}