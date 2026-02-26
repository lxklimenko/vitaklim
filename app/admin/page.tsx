import { createClient } from '@/app/lib/supabase-server'
import { notFound } from 'next/navigation'
import Chart from './Chart'

export default async function AdminPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.email !== 'klim93@bk.ru') {
    notFound()
  }

  const { data: stats } = await supabase
    .from('today_dashboard')
    .select('*')
    .single()

  if (!stats) {
    return <div className="p-10 text-white">Нет данных за сегодня</div>
  }

  const { data: chartData } = await supabase
    .from('last_7_days_stats')
    .select('*')

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

      {chartData && (
        <div className="mt-16">
          <h2 className="text-2xl font-bold mb-6">Последние 7 дней</h2>
          <Chart data={chartData} />
        </div>
      )}
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