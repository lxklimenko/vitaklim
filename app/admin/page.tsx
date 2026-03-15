import { createClient } from '@/app/lib/supabase-server'
import Chart from './Chart'
import UsersChart from './UsersChart'

export default async function AdminPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 1. Если вообще не залогинен — показываем сообщение
  if (!user) {
    return (
      <div style={{ color: "white", padding: 40 }}>
        USER NOT AUTHORIZED
      </div>
    )
  }

  // Проверяем что пользователь админ
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return (
      <div style={{ color: "white", padding: 40 }}>
        NOT ADMIN
      </div>
    )
  }

  const { data: stats } = await supabase
    .from('today_dashboard')
    .select('*')
    .single()

  if (!stats) {
    return <div className="p-10 text-white">Нет данных за сегодня</div>
  }

  const { data: chart7 } = await supabase
    .from('last_7_days_stats')
    .select('*')

  const { data: chart30 } = await supabase
    .from('last_30_days_stats')
    .select('*')

  // Запрос данных ежедневно активных пользователей
  const { data: dau } = await supabase
    .from('daily_active_users')
    .select('*')

  // Запрос последних 20 генераций
  const { data: generations } = await supabase
    .from('generations')
    .select('user_id, prompt, cost, status, created_at')
    .order('created_at', { ascending: false })
    .limit(20)

  // Запрос всех списаний бананов с данными профиля
  const { data: userSpending } = await supabase
    .from('generations')
    .select(`
      cost,
      profiles (
        id,
        telegram_username,
        telegram_first_name,
        telegram_avatar_url
      )
    `)

  // Суммируем траты по каждому пользователю с учётом профиля
  const spendingMap: Record<string, any> = {}

  userSpending?.forEach((g: any) => {
    const user = g.profiles

    if (!user) return

    if (!spendingMap[user.id]) {
      spendingMap[user.id] = {
        id: user.id,
        username: user.telegram_username,
        name: user.telegram_first_name,
        avatar: user.telegram_avatar_url,
        total: 0
      }
    }

    spendingMap[user.id].total += g.cost || 0
  })

  const spendingList = Object.values(spendingMap)
    .sort((a: any, b: any) => b.total - a.total)
    .slice(0, 20)

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-10">
      <h1 className="text-3xl font-bold mb-10">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title="Генерации" value={stats.total_generations} />
        <Card title="Успешные" value={stats.completed} />
        <Card title="Ошибки" value={stats.failed} />

        <Card title="Выручка" value={stats.total_revenue ?? 0} />
        <Card title="Ultra" value={stats.ultra_count} />
        <Card title="Ultra выручка" value={stats.ultra_revenue ?? 0} />

        <Card title="Активные пользователи" value={stats.active_users} />
        <Card
          title="Среднее время (сек)"
          value={
            stats.avg_generation_time_ms
              ? (stats.avg_generation_time_ms / 1000).toFixed(2)
              : 0
          }
        />
        <Card title="ARPU" value={Number(stats.arpu).toFixed(2)} />
        <Card title="Refunds" value={stats.refund_count} />
      </div>

      {(chart7 || chart30) && (
        <div className="mt-16">
          <h2 className="text-2xl font-bold mb-6">Статистика за периоды</h2>
          <Chart chart7={chart7} chart30={chart30} />
        </div>
      )}

      {/* Блок с активными пользователями */}
      {dau && (
        <div className="mt-16">
          <h2 className="text-2xl font-bold mb-6">Активные пользователи</h2>
          <UsersChart data={dau} />
        </div>
      )}

      {/* Таблица последних генераций */}
      <div className="mt-16">
        <h2 className="text-2xl font-bold mb-6">Последние генерации</h2>

        <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-white/50">
                <th className="pb-3">User</th>
                <th className="pb-3">Prompt</th>
                <th className="pb-3">Cost</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Time</th>
              </tr>
            </thead>

            <tbody>
              {generations?.map((g: any) => (
                <tr key={g.created_at} className="border-t border-white/10">
                  <td className="py-2">{g.user_id}</td>
                  <td className="py-2 max-w-[300px] truncate">{g.prompt}</td>
                  <td className="py-2">{g.cost} 🍌</td>
                  <td className="py-2">{g.status}</td>
                  <td className="py-2">{new Date(g.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Таблица топа пользователей по тратам */}
      <div className="mt-16">
        <h2 className="text-2xl font-bold mb-6">Топ пользователей по тратам</h2>

        <div className="bg-[#141414] border border-white/10 rounded-2xl p-6">
          <table className="w-full text-left">
            <thead>
              <tr className="text-white/50">
                <th className="pb-3">User</th>
                <th className="pb-3">Username</th>
                <th className="pb-3">Name</th>
                <th className="pb-3">Spent</th>
              </tr>
            </thead>

            <tbody>
              {spendingList.map((u: any, i: number) => (
                <tr key={i} className="border-t border-white/10">
                  <td className="py-2">
                    {u.avatar ? (
                      <img
                        src={u.avatar}
                        alt="avatar"
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      "👤"
                    )}
                  </td>
                  <td className="py-2">
                    <a
                      href={`/admin/users/${u.id}`}
                      className="hover:underline"
                    >
                      @{u.username || "unknown"}
                    </a>
                  </td>
                  <td className="py-2">{u.name || "—"}</td>
                  <td className="py-2 font-semibold">{u.total} 🍌</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Card({ title, value }: { title: string; value: any }) {
  return (
    <div className="bg-[#141414] border border-white/10 rounded-2xl p-6">
      <div className="text-white/50 text-sm mb-2">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  )
}