import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase-server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    // 1. Проверяем пользователя
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (!user || userError) {
      return NextResponse.json(
        { error: "Не авторизован" },
        { status: 401 }
      );
    }

    const { id } = await req.json();

    if (!id) {
      return NextResponse.json(
        { error: "ID не передан" },
        { status: 400 }
      );
    }

    // 2. Получаем запись
    const { data: generation, error: fetchError } = await supabase
      .from("generations")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !generation) {
      return NextResponse.json(
        { error: "Генерация не найдена" },
        { status: 404 }
      );
    }

    // 3. Проверяем владельца
    if (generation.user_id !== user.id) {
      return NextResponse.json(
        { error: "Нет доступа" },
        { status: 403 }
      );
    }

    // 4. Удаляем файл из Storage
    try {
      const url = new URL(generation.image_url);

      // Получаем полный путь
      // /storage/v1/object/public/generations/userid/filename.jpg
      const parts = url.pathname.split("/generations/");

      if (parts.length > 1) {
        const filePath = parts[1]; // userid/filename.jpg

        await supabase.storage
          .from("generations")
          .remove([filePath]);

        console.log("Deleted file path:", filePath);
      }
    } catch (err) {
      console.error("Storage delete error:", err);
    }

    // 5. Удаляем запись из БД
    const { error: deleteError } = await supabase
      .from("generations")
      .delete()
      .eq("id", id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error("Delete API error:", error);
    return NextResponse.json(
      { error: "Ошибка удаления" },
      { status: 500 }
    );
  }
}