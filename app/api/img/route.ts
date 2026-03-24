// app/api/img/route.ts
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');

  // Если ссылки нет, выдаем ошибку
  if (!url) {
    return new NextResponse("Ссылка не найдена", { status: 404 });
  }

  // Незаметно перенаправляем пользователя на оригинальный файл в Supabase
  return NextResponse.redirect(url);
}