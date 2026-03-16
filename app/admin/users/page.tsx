export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/app/lib/supabase-server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { notFound } from "next/navigation";

// В Next.js 15 searchParams — это Promise
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Защита: только определённые пользователи
  if (
    user?.email !== "admin@klex.pro" &&
    user?.id !== "0ec2da81-c1d4-46d8-bedc-6b65e0e6f4b4"
  ) {
    notFound(); // 404, если доступ запрещён
  }

  // 2. Готовим запрос через сервисную роль (обходит RLS)
  let query = supabaseAdmin
    .from("admin_users_view")
    .select("*", { count: "exact" });

  // ЛОГИКА ФИЛЬТРАЦИИ "АКТИВНЫЕ СЕГОДНЯ"
  if (filter === "active_today") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Получаем ID всех пользователей, у которых были генерации сегодня
    const { data: activeTodayData } = await supabaseAdmin
      .from("generations")
      .select("user_id")
      .gte("created_at", today.toISOString());

    // Извлекаем уникальные ID
    const activeIds = Array.from(
      new Set(activeTodayData?.map((item) => item.user_id) || [])
    );

    // Применяем фильтр или делаем заведомо пустой результат
    if (activeIds.length > 0) {
      query = query.in("id", activeIds);
    } else {
      // UUID, которого точно нет в базе
      query = query.eq("id", "00000000-0000-0000-0000-000000000000");
    }
  }

  // 3. Выполняем запрос
  const { data: users, error, count } = await query.order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-10">
        <div className="bg-red-900/20 p-4 rounded border border-red-500/30">
          Ошибка загрузки: {error.message}
        </div>
      </div>
    );
  }

  // Определяем заголовок в зависимости от фильтра
  const pageTitle = filter === "active_today" ? "Активные сегодня" : "Все пользователи";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-10">
      {/* Навигация */}
      <nav className="flex gap-6 mb-12 bg-[#141414] p-4 rounded-2xl border border-white/5">
        <Link
          href="/admin"
          className="text-white/60 hover:text-blue-400 transition"
        >
          📈 Дашборд
        </Link>
        <Link
          href="/admin/users"
          className="text-white hover:text-blue-400 font-medium"
        >
          👥 Пользователи
        </Link>
        <Link
          href="/admin/promos"
          className="text-white/60 hover:text-blue-400 transition"
        >
          🎟 Промокоды
        </Link>
      </nav>

      {/* Заголовок и сброс фильтра */}
      <div className="flex justify-between items-end mb-10">
        <div>
          <h1 className="text-3xl font-bold">
            {pageTitle}{" "}
            <span className="text-white/40">({count})</span>
          </h1>
        </div>
        {filter === "active_today" && (
          <Link
            href="/admin/users"
            className="text-sm bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl transition"
          >
            ✕ Сбросить фильтр
          </Link>
        )}
      </div>

      {/* Таблица пользователей */}
      <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 overflow-x-auto">
        <table className="w-full text-left min-w-200">
          <thead>
            <tr className="text-white/50 border-b border-white/10">
              <th className="pb-4">Юзер</th>
              <th className="pb-4">Username</th>
              <th className="pb-4">Баланс</th>
              <th className="pb-4">Генерации</th>
              <th className="pb-4">Траты</th>
              <th className="pb-4">Рефералы</th>
              <th className="pb-4">Регистрация</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u: any) => (
              <tr
                key={u.id}
                className="border-t border-white/5 hover:bg-white/5 transition"
              >
                <td className="py-4">
                  {u.telegram_avatar_url ? (
                    <img
                      src={u.telegram_avatar_url}
                      className="w-8 h-8 rounded-full"
                      alt=""
                    />
                  ) : (
                    "👤"
                  )}
                </td>
                <td className="py-4">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="text-blue-400 hover:underline"
                  >
                    @{u.telegram_username || "no_name"}
                  </Link>
                </td>
                <td className="py-4 font-mono">{u.balance} 🍌</td>
                <td className="py-4">{u.generations || 0}</td>
                <td className="py-4 text-green-400">
                  {u.spent || 0} 🍌
                </td>
                <td className="py-4 text-center">
                  {u.referrals_count || 0}
                </td>
                <td className="py-4 text-sm text-white/40">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}