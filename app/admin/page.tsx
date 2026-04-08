import { createClient } from '@/app/lib/supabase-server'
import { supabaseAdmin } from '@/app/lib/supabase-admin'
import Link from 'next/link'
import Chart from './Chart'
import UsersChart from './UsersChart'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div style={{ color: "white", padding: 40 }}>USER NOT AUTHORIZED</div>
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return <div style={{ color: "white", padding: 40 }}>NOT ADMIN</div>
  }

  const { data: stats } = await supabase
    .from('today_dashboard')
    .select('*')
    .single()

  const { data: chart7 } = await supabase.from('last_7_days_stats').select('*')
  const { data: chart30 } = await supabase.from('last_30_days_stats').select('*')
  const { data: dau } = await supabase.from('daily_active_users').select('*')

  // Последние генерации с именами пользователей
  const { data: generations } = await supabaseAdmin
    .from('generations')
    .select('id, user_id, prompt, cost, status, created_at, is_public')
    .order('created_at', { ascending: false })
    .limit(20)

  // Загружаем профили для генераций
  const genUserIds = [...new Set((generations || []).map(g => g.user_id))]
  const { data: genProfiles } = await supabaseAdmin
    .from('profiles')
    .select('id, telegram_first_name, telegram_username, telegram_avatar_url')
    .in('id', genUserIds.length > 0 ? genUserIds : ['none'])
  const genProfileMap = Object.fromEntries((genProfiles || []).map(p => [p.id, p]))

  // Топ пользователей по тратам
  const { data: userSpending } = await supabaseAdmin
    .from('generations')
    .select('cost, user_id')
    .eq('status', 'completed')

  const spendingMap: Record<string, any> = {}
  userSpending?.forEach((g: any) => {
    if (!spendingMap[g.user_id]) {
      spendingMap[g.user_id] = { id: g.user_id, total: 0 }
    }
    spendingMap[g.user_id].total += g.cost || 0
  })

  const topUserIds = Object.values(spendingMap)
    .sort((a: any, b: any) => b.total - a.total)
    .slice(0, 20)
    .map((u: any) => u.id)

  const { data: topProfiles } = await supabaseAdmin
    .from('profiles')
    .select('id, telegram_first_name, telegram_username, telegram_avatar_url')
    .in('id', topUserIds.length > 0 ? topUserIds : ['none'])

  const topProfileMap = Object.fromEntries((topProfiles || []).map(p => [p.id, p]))

  const spendingList = Object.values(spendingMap)
    .sort((a: any, b: any) => b.total - a.total)
    .slice(0, 20)
    .map((u: any) => ({ ...u, ...topProfileMap[u.id] }))

  // Дополнительные метрики
  const { count: publicCount } = await supabaseAdmin
    .from('generations')
    .select('*', { count: 'exact', head: true })
    .eq('is_public', true)
    .eq('status', 'completed')

  const { count: likesCount } = await supabaseAdmin
    .from('likes')
    .select('*', { count: 'exact', head: true })

  const { count: commentsCount } = await supabaseAdmin
    .from('comments')
    .select('*', { count: 'exact', head: true })

  const { count: totalUsers } = await supabaseAdmin
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 md:p-10">
      {/* Навигация */}
      <nav className="flex gap-4 mb-10 bg-[#141414] p-4 rounded-2xl border border-white/5 flex-wrap">
        <Link href="/admin" className="text-white font-medium">📈 Дашборд</Link>
        <Link href="/admin/users" className="text-white/60 hover:text-white transition">👥 Пользователи</Link>
        <Link href="/admin/prompts" className="text-white/60 hover:text-white transition">➕ Добавить промпт</Link>
        <Link href="/admin/promos" className="text-white/20 cursor-not-allowed">🎟 Промокоды (скоро)</Link>
      </nav>

      <h1 className="text-3xl font-bold mb-8">Admin Dashboard 🍌</h1>

      {/* Основные метрики */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card title="Всего пользователей" value={totalUsers ?? 0} />
        <Card title="Публичных генераций" value={publicCount ?? 0} />
        <Card title="Лайков" value={likesCount ?? 0} />
        <Card title="Комментариев" value={commentsCount ?? 0} />
      </div>

      {/* Статистика за сегодня */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <Card title="Генераций сегодня" value={stats.total_generations} />
          <Card title="Успешных" value={stats.completed} />
          <Card title="Ошибок" value={stats.failed} />
          <Card title="Выручка сегодня" value={`${stats.total_revenue ?? 0} ₽`} />
          <Card title="Активных юзеров" value={stats.active_users} />
          <Card title="ARPU" value={Number(stats.arpu ?? 0).toFixed(2)} />
        </div>
      )}

      {/* Графики */}
      {(chart7 || chart30) && (
        <div className="mt-10">
          <h2 className="text-xl font-bold mb-4">Статистика за периоды</h2>
          <Chart chart7={chart7} chart30={chart30} />
        </div>
      )}

      {dau && (
        <div className="mt-10">
          <h2 className="text-xl font-bold mb-4">Активные пользователи</h2>
          <UsersChart data={dau} />
        </div>
      )}

      {/* Последние генерации */}
      <div className="mt-10">
        <h2 className="text-xl font-bold mb-4">Последние генерации</h2>
        <div className="bg-[#141414] border border-white/10 rounded-2xl overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-white/40 border-b border-white/10">
                <th className="p-4">Пользователь</th>
                <th className="p-4">Промпт</th>
                <th className="p-4">Цена</th>
                <th className="p-4">Статус</th>
                <th className="p-4">Публичная</th>
                <th className="p-4">Время</th>
              </tr>
            </thead>
            <tbody>
              {generations?.map((g: any) => {
                const p = genProfileMap[g.user_id]
                const name = p?.telegram_first_name || p?.telegram_username || 'Аноним'
                return (
                  <tr key={g.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                    <td className="p-4">
                      <Link href={`/user/${g.user_id}`} className="flex items-center gap-2 hover:text-white/80">
                        <div className="w-7 h-7 rounded-full overflow-hidden bg-white/10 flex-shrink-0">
                          {p?.telegram_avatar_url ? (
                            <img src={p.telegram_avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px]">
                              {name[0].toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span className="text-[13px]">{name}</span>
                      </Link>
                    </td>
                    <td className="p-4 max-w-48 truncate text-white/70">{g.prompt}</td>
                    <td className="p-4">{g.cost} 🍌</td>
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
        </div>
      </div>

      {/* Топ по тратам */}
      <div className="mt-10 mb-20">
        <h2 className="text-xl font-bold mb-4">Топ пользователей по тратам</h2>
        <div className="bg-[#141414] border border-white/10 rounded-2xl overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-white/40 border-b border-white/10">
                <th className="p-4">#</th>
                <th className="p-4">Пользователь</th>
                <th className="p-4">Потрачено</th>
              </tr>
            </thead>
            <tbody>
              {spendingList.map((u: any, i: number) => {
                const name = u.telegram_first_name || u.telegram_username || 'Аноним'
                return (
                  <tr key={u.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                    <td className="p-4 text-white/30">{i + 1}</td>
                    <td className="p-4">
                      <Link href={`/user/${u.id}`} className="flex items-center gap-2 hover:text-white/80">
                        <div className="w-7 h-7 rounded-full overflow-hidden bg-white/10 flex-shrink-0">
                          {u.telegram_avatar_url ? (
                            <img src={u.telegram_avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px]">
                              {name[0].toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span className="text-[13px]">{name}</span>
                      </Link>
                    </td>
                    <td className="p-4 font-semibold">{u.total} 🍌</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Card({ title, value }: { title: string; value: any }) {
  return (
    <div className="bg-[#141414] border border-white/10 rounded-2xl p-5">
      <div className="text-white/40 text-xs mb-2 uppercase tracking-wider">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}