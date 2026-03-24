// app/api/download/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const filePath = searchParams.get('file');

  if (!filePath) {
    return new NextResponse("Файл не найден", { status: 404 });
  }

  // 1. Скачиваем оригинальный файл из приватного бакета Supabase
  const { data, error } = await supabaseAdmin.storage
    .from('generations-private')
    .download(filePath);

  if (error || !data) {
    console.error("Ошибка скачивания файла:", error);
    return new NextResponse("Ошибка доступа к файлу", { status: 500 });
  }

  const buffer = await data.arrayBuffer();

  // 2. Узнаем формат
  let extension = 'jpg';
  if (data.type.includes('webp')) extension = 'webp';
  else if (data.type.includes('png')) extension = 'png';

  // 3. 🚀 МАГИЯ: Отдаем файл с командой "attachment"
  // Это заставит телефон юзера МГНОВЕННО сохранить файл, не открывая никаких страниц
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": data.type,
      "Content-Disposition": `attachment; filename="KLEX_Original.${extension}"`,
    },
  });
}