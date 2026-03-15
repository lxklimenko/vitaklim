export const dynamic = "force-dynamic"

import { supabaseAdmin } from '@/app/lib/supabase-admin'

export default async function AdminUserPage({ params }: any) {

  const supabase = supabaseAdmin
  const userId = params.id

  const { data: user } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  const { count: totalGenerations } = await supabase
    .from('generations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  const { count: todayGenerations } = await supabase
    .from('generations')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', new Date().toISOString().split('T')[0])

  const { data: spent } = await supabase
    .from('generations')
    .select('cost')
    .eq('user_id', userId)

  const spentBananas =
    spent?.reduce((sum: number, g: any) => sum + (g.cost || 0), 0) || 0

  const { data: generations } = await supabase
    .from('generations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-10">

      <h1 className="text-3xl font-bold mb-10">
        @{user?.telegram_username}
      </h1>

      <div className="grid md:grid-cols-4 gap-6 mb-10">

        <Card title="Balance" value={`${user?.balance} 🍌`} />

        <Card title="Generations today" value={todayGenerations || 0} />

        <Card title="Total generations" value={totalGenerations || 0} />

        <Card title="Spent bananas" value={`${spentBananas} 🍌`} />

      </div>

      <div className="bg-[#141414] border border-white/10 rounded-2xl p-6">

        <h2 className="text-xl mb-6">Last generations</h2>

        <div className="grid md:grid-cols-4 gap-4">

          {generations?.map((g:any) => (
            <img
              key={g.id}
              src={g.image_url}
              className="rounded-lg"
            />
          ))}

        </div>

      </div>

    </div>
  )
}

function Card({ title, value }: any) {
  return (
    <div className="bg-[#141414] border border-white/10 rounded-2xl p-6">
      <div className="text-white/50 text-sm mb-2">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  )
}