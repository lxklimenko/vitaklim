export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/app/lib/supabase-server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { notFound } from "next/navigation";
import AddBalanceButton from './AddBalanceButton'

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; search?: string }>;
}) {
  const { filter, search } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (
    user?.email !== "admin@klex.pro" &&
    user?.id !== "0ec2da81-c1d4-46d8-bedc-6b65e0e6f4b4"
  ) {
    notFound();
  }

  let query = supabaseAdmin
    .from("admin_users_view")
    .select("*", { count: "exact" });

  // Фильтр по username
  if (search?.trim()) {
    query = query.ilike("telegram_username", `%${search.trim()}%`)
  }

  // Фильтр новые сегодня
  if (filter === "new_today") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    query = query.gte("created_at", today.toISOString());
  }

  // Фильтр активные сегодня
  if (filter === "active_today") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: activeTodayData } = await supabaseAdmin
      .from("generations")
      .select("user_id")
      .gte("created_at", today.toISOString());

    const activeIds = Array.from(
      new Set(activeTodayData?.map((item) => item.user_id) || [])
    );

    if (activeIds.length > 0) {
      query = query.in("id", activeIds);
    } else {
      query = query.eq("id", "00000000-0000-0000-0000-000000000000");
    }
  }

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

  const pageTitle = filter === "active_today" ? "Активные сегодня" : "Все пользователи";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-10">
      <nav className="flex gap-6 mb-12 bg-[#141414] p-4 rounded-2xl border border-white/5">
        <Link href="/admin" className="text-white/60 hover:text-blue-400 transition">📈 Дашборд</Link>
        <Link href="/admin/users" className="text-white hover:text-blue-400 font-medium">👥 Пользователи</Link>
        <Link href="/admin/promos" className="text-white/60 hover:text-blue-400 transition">🎟 Промокоды</Link>
      </nav>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">
          {pageTitle}{" "}
          <span className="text-white/40">({count})</span>
        </h1>
        {filter === "active_today" && (
          <Link
            href="/admin/users"
            className="text-sm bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl transition"
          >
            ✕ Сбросить фильтр
          </Link>
        )}
      </div>

      {/* Поиск */}
      <form method="GET" action="/admin/users" className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            name="search"
            defaultValue={search || ''}
            placeholder="Поиск по username..."
            className="flex-1 bg-[#141414] border border-white/10 rounded-xl px-4 py-2.5 text-[14px] text-white placeholder:text-white/25 focus:outline-none focus:border-white/30 transition max-w-sm"
          />
          <button
            type="submit"
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[14px] transition"
          >
            🔍 Найти
          </button>
          {search && (
            <Link
              href="/admin/users"
              className="px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[14px] transition text-white/50"
            >
              ✕ Сброс
            </Link>
          )}
        </div>
      </form>

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
              <th className="pb-4">Начислить</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u: any) => (
              <tr key={u.id} className="border-t border-white/5 hover:bg-white/5 transition">
                <td className="py-4">
                  {u.telegram_avatar_url ? (
                    <img src={u.telegram_avatar_url} className="w-8 h-8 rounded-full" alt="" />
                  ) : "👤"}
                </td>
                <td className="py-4">
                  <Link href={`/admin/users/${u.id}`} className="text-blue-400 hover:underline">
                    @{u.telegram_username || "no_name"}
                  </Link>
                </td>
                <td className="py-4 font-mono">{u.balance} 🍌</td>
                <td className="py-4">{u.generations || 0}</td>
                <td className="py-4 text-green-400">{u.spent || 0} 🍌</td>
                <td className="py-4 text-center">{u.referrals_count || 0}</td>
                <td className="py-4 text-sm text-white/40">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td className="py-4">
                  <AddBalanceButton userId={u.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users?.length === 0 && (
          <p className="text-center text-white/30 py-8">Пользователи не найдены</p>
        )}
      </div>
    </div>
  );
}