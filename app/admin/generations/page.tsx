export const dynamic = "force-dynamic";

import Link from "next/link";
import { createClient } from "@/app/lib/supabase-server";
import { supabaseAdmin } from "@/app/lib/supabase-admin";
import { notFound } from "next/navigation";

export default async function AdminGenerationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; status?: string }>;
}) {
  const { filter, status } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (
    user?.email !== "admin@klex.pro" &&
    user?.id !== "0ec2da81-c1d4-46d8-bedc-6b65e0e6f4b4"
  ) {
    notFound();
  }

  let query = supabaseAdmin
    .from("generations")
    .select("id, user_id, prompt, cost, status, created_at, is_public, model_id", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(100)

  if (filter === "today") {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    query = query.gte("created_at", today.toISOString())
  }

  if (status) {
    query = query.eq("status", status)
  }

  const { data: generations, count } = await query

  const userIds = [...new Set((generations || []).map(g => g.user_id))]
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, telegram_first_name, telegram_username, telegram_avatar_url")
    .in("id", userIds.length > 0 ? userIds : ["none"])
  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))

  const title = filter === "today" ? "Генерации сегодня" : "Все генерации"

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 md:p-10">
      <nav className="flex gap-4 mb-10 bg-[#141414] p-4 rounded-2xl border border-white/5 flex-wrap">
        <Link href="/admin" className="text-white/60 hover:text-white transition">📈 Дашборд</Link>
        <Link href="/admin/users" className="text-white/60 hover:text-white transition">👥 Пользователи</Link>
        <Link href="/admin/generations" className="text-white font-medium">⚡ Генерации</Link>
      </nav>

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">
          {title} <span className="text-white/40">({count})</span>
        </h1>
        <div className="flex gap-2">
          <Link href="/admin/generations?filter=today" className={`px-3 py-1.5 rounded-xl text-sm transition ${filter === 'today' && !status ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10'}`}>
            Сегодня
          </Link>
          <Link href="/admin/generations?filter=today&status=completed" className={`px-3 py-1.5 rounded-xl text-sm transition ${status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-white/5 hover:bg-white/10'}`}>
            Успешные
          </Link>
          <Link href="/admin/generations?filter=today&status=failed" className={`px-3 py-1.5 rounded-xl text-sm transition ${status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-white/5 hover:bg-white/10'}`}>
            Ошибки
          </Link>
          <Link href="/admin/generations" className="px-3 py-1.5 rounded-xl text-sm bg-white/5 hover:bg-white/10 transition">
            Все
          </Link>
        </div>
      </div>

      <div className="bg-[#141414] border border-white/10 rounded-2xl overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-white/40 border-b border-white/10">
              <th className="p-4">Пользователь</th>
              <th className="p-4">Промпт</th>
              <th className="p-4">Модель</th>
              <th className="p-4">Цена</th>
              <th className="p-4">Статус</th>
              <th className="p-4">Публичная</th>
              <th className="p-4">Время</th>
            </tr>
          </thead>
          <tbody>
            {generations?.map((g: any) => {
              const p = profileMap[g.user_id]
              const name = p?.telegram_first_name || p?.telegram_username || 'Аноним'
              return (
                <tr key={g.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="p-4">
                    <Link href={`/user/${g.user_id}`} className="flex items-center gap-2 hover:text-white/80">
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-white/10 flex-shrink-0 flex items-center justify-center text-[10px] font-bold">
                        {p?.telegram_avatar_url ? (
                          <img src={p.telegram_avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : name[0].toUpperCase()}
                      </div>
                      <span>{name}</span>
                    </Link>
                  </td>
                  <td className="p-4 max-w-48 truncate text-white/70">{g.prompt}</td>
                  <td className="p-4 text-white/50 text-[11px]">{g.model_id || '—'}</td>
                  <td className="p-4 font-medium">{g.cost > 0 ? `${g.cost} 🍌` : '—'}</td>
                  <td className="p-4">
                    <span className={`text-[11px] px-2 py-1 rounded-full ${
                      g.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      g.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                      'bg-white/10 text-white/50'
                    }`}>
                      {g.status}
                    </span>
                  </td>
                  <td className="p-4">
                    {g.is_public ? (
                      <span className="text-[11px] px-2 py-1 rounded-full bg-blue-500/20 text-blue-400">Да</span>
                    ) : (
                      <span className="text-[11px] text-white/20">—</span>
                    )}
                  </td>
                  <td className="p-4 text-white/40 text-[12px]">
                    {new Date(g.created_at).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {!generations?.length && (
          <p className="text-center text-white/30 py-8">Генераций не найдено</p>
        )}
      </div>
    </div>
  )
}
