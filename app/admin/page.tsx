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
    .gt('cost', 0)

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

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { count: newUsersToday } = await supabaseAdmin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today.toISOString())

  // Пополнения сегодня
  const { data: todayPayments } = await supabaseAdmin
    .from('payments')
    .select('user_id, amount, created_at')
    .eq('status', 'succeeded')
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false })

  // Загружаем профили для платежей
  const paymentUserIds = [...new Set((todayPayments || []).map(p => p.user_id))]
  const { data: paymentProfiles } = await supabaseAdmin
    .from('profiles')
    .select('id, telegram_first_name, telegram_username, telegram_avatar_url')
    .in('id', paymentUserIds.length > 0 ? paymentUserIds : ['none'])
  const paymentProfileMap = Object.fromEntries((paymentProfiles || []).map(p => [p.id, p]))

  // Повторные пополнения
  const { data: repeatPayments } = await supabaseAdmin
    .from('payments')
    .select('user_id, amount, created_at')
    .eq('status', 'succeeded')
    .order('created_at', { ascending: false })

  // Считаем количество пополнений по каждому пользователю
  const repeatMap: Record<string, { count: number, total: number }> = {}
  repeatPayments?.forEach(p => {
    if (!repeatMap[p.user_id]) repeatMap[p.user_id] = { count: 0, total: 0 }
    repeatMap[p.user_id].count++
    repeatMap[p.user_id].total += p.amount
  })

  // Оставляем только тех кто пополнял больше 1 раза
  const repeatUsers = Object.entries(repeatMap)
    .filter(([_, v]) => v.count > 1)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)

  // Загружаем профили повторных плательщиков
  const repeatUserIds = repeatUsers.map(([id]) => id)
  const { data: repeatProfiles } = await supabaseAdmin
    .from('profiles')
    .select('id, telegram_first_name, telegram_username, telegram_avatar_url')
    .in('id', repeatUserIds.length > 0 ? repeatUserIds : ['none'])
  const repeatProfileMap = Object.fromEntries((repeatProfiles || []).map(p => [p.id, p]))

  // Новые пользователи по дням за 7 дней
  const { data: newUsersByDay } = await supabaseAdmin
    .from('profiles')
    .select('created_at')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: true })

  // Группируем по дням
  const usersByDay: Record<string, number> = {}
  newUsersByDay?.forEach(u => {
    const day = new Date(u.created_at).toLocaleDateString('ru', { day: 'numeric', month: 'short' })
    usersByDay[day] = (usersByDay[day] || 0) + 1
  })
  const newUsersChartData = Object.entries(usersByDay).map(([date, count]) => ({ date, count }))

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
        <Card title="Всего пользователей" value={totalUsers ?? 0} href="/admin/users" />
        <Card title="Новых сегодня" value={newUsersToday ?? 0} href="/admin/users?filter=new_today" />
        <Card title="Лайков" value={likesCount ?? 0} />
        <Card title="Комментариев" value={commentsCount ?? 0} />
      </div>

      {/* Статистика за сегодня */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <Card title="Генераций сегодня" value={stats.total_generations} href="/admin/generations?filter=today" />
          <Card title="Успешных" value={stats.completed} href="/admin/generations?filter=today&status=completed" />
          <Card title="Ошибок" value={stats.failed} href="/admin/generations?filter=today&status=failed" />
          <Card title="Выручка сегодня" value={`${stats.total_revenue ?? 0} ₽`} />
          <Card title="Активных юзеров" value={stats.active_users} href="/admin/users?filter=active_today" />
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

      {/* Пополнения сегодня */}
      <div className="mt-10">
        <h2 className="text-xl font-bold mb-4">
          Пополнения сегодня
          <span className="text-white/40 text-base font-normal ml-2">
            {todayPayments?.length || 0} платежей · {todayPayments?.reduce((s, p) => s + p.amount, 0) || 0} ₽
          </span>
        </h2>
        {!todayPayments?.length ? (
          <p className="text-white/30 text-sm">Пополнений сегодня нет</p>
        ) : (
          <div className="bg-[#141414] border border-white/10 rounded-2xl overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-white/40 border-b border-white/10">
                  <th className="p-4">Пользователь</th>
                  <th className="p-4">Сумма</th>
                  <th className="p-4">Время</th>
                </tr>
              </thead>
              <tbody>
                {todayPayments.map((p: any) => {
                  const profile = paymentProfileMap[p.user_id]
                  const name = profile?.telegram_first_name || profile?.telegram_username || 'Аноним'
                  return (
                    <tr key={p.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                      <td className="p-4">
                        <Link href={`/user/${p.user_id}`} className="flex items-center gap-2 hover:text-white/80">
                          <div className="w-7 h-7 rounded-full overflow-hidden bg-white/10 flex-shrink-0 flex items-center justify-center text-[10px] font-bold">
                            {profile?.telegram_avatar_url ? (
                              <img src={profile.telegram_avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : name[0].toUpperCase()}
                          </div>
                          <span>{name}</span>
                        </Link>
                      </td>
                      <td className="p-4 font-semibold text-green-400">{p.amount} ₽</td>
                      <td className="p-4 text-white/40 text-[12px]">
                        {new Date(p.created_at).toLocaleString('ru', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Повторные пополнения */}
      <div className="mt-10">
        <h2 className="text-xl font-bold mb-4">
          Повторные пополнения
          <span className="text-white/40 text-base font-normal ml-2">
            {repeatUsers.length} пользователей
          </span>
        </h2>
        {repeatUsers.length === 0 ? (
          <p className="text-white/30 text-sm">Повторных пополнений нет</p>
        ) : (
          <div className="bg-[#141414] border border-white/10 rounded-2xl overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-white/40 border-b border-white/10">
                  <th className="p-4">#</th>
                  <th className="p-4">Пользователь</th>
                  <th className="p-4">Пополнений</th>
                  <th className="p-4">Всего потрачено</th>
                </tr>
              </thead>
              <tbody>
                {repeatUsers.map(([userId, data], i) => {
                  const p = repeatProfileMap[userId]
                  const name = p?.telegram_first_name || p?.telegram_username || 'Аноним'
                  return (
                    <tr key={userId} className="border-t border-white/5 hover:bg-white/[0.02]">
                      <td className="p-4 text-white/30">{i + 1}</td>
                      <td className="p-4">
                        <Link href={`/user/${userId}`} className="flex items-center gap-2 hover:text-white/80">
                          <div className="w-7 h-7 rounded-full overflow-hidden bg-white/10 flex-shrink-0 flex items-center justify-center text-[10px] font-bold">
                            {p?.telegram_avatar_url ? (
                              <img src={p.telegram_avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : name[0].toUpperCase()}
                          </div>
                          <span>{name}</span>
                        </Link>
                      </td>
                      <td className="p-4">
                        <span className="text-yellow-400 font-semibold">{data.count}x</span>
                      </td>
                      <td className="p-4 font-semibold text-green-400">{data.total} ₽</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* График новых пользователей */}
      <div className="mt-10">
        <h2 className="text-xl font-bold mb-4">Новые пользователи за 7 дней</h2>
        <div className="bg-[#141414] border border-white/10 rounded-2xl p-6">
          <div className="flex items-end gap-2 h-32">
            {newUsersChartData.map((d, i) => {
              const max = Math.max(...newUsersChartData.map(x => x.count))
              const height = max > 0 ? (d.count / max) * 100 : 0
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-white/40">{d.count}</span>
                  <div
                    className="w-full bg-white/20 rounded-sm transition-all"
                    style={{ height: `${height}%`, minHeight: '4px' }}
                  />
                  <span className="text-[9px] text-white/30 truncate w-full text-center">{d.date}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

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

function Card({ title, value, href }: { title: string; value: any; href?: string }) {
  if (href) {
    return (
      <Link href={href} className="bg-[#141414] border border-white/10 rounded-2xl p-5 hover:border-white/30 hover:bg-white/[0.03] transition-all cursor-pointer block">
        <div className="text-white/40 text-xs mb-2 uppercase tracking-wider">{title}</div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-[10px] text-white/20 mt-2">Нажмите для деталей →</div>
      </Link>
    )
  }
  return (
    <div className="bg-[#141414] border border-white/10 rounded-2xl p-5">
      <div className="text-white/40 text-xs mb-2 uppercase tracking-wider">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}