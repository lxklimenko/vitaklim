import { createClient } from '@/app/lib/supabase-server'

export default async function AdminUserPage({ params }: any) {
  const supabase = await createClient()

  const userId = params.id

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  const { data: generations } = await supabase
    .from('generations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-10">

      <h1 className="text-3xl font-bold mb-10">
        Пользователь
      </h1>

      {profile && (
        <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 mb-10">

          <div className="flex items-center gap-4">

            {profile.telegram_avatar_url && (
              <img
                src={profile.telegram_avatar_url}
                className="w-12 h-12 rounded-full"
              />
            )}

            <div>
              <div className="text-xl font-semibold">
                {profile.telegram_first_name}
              </div>

              <div className="text-white/50">
                @{profile.telegram_username}
              </div>
            </div>

          </div>

          <div className="mt-6 grid grid-cols-3 gap-6">

            <Stat title="Balance" value={`${profile.balance} 🍌`} />

            <Stat title="Referrals" value={profile.referrals_count} />

            <Stat title="Telegram ID" value={profile.telegram_id} />

          </div>

        </div>
      )}

      <h2 className="text-2xl font-bold mb-6">
        Генерации пользователя
      </h2>

      <div className="bg-[#141414] border border-white/10 rounded-2xl p-6">

        <table className="w-full text-left">

          <thead>
            <tr className="text-white/50">
              <th className="pb-3">Prompt</th>
              <th className="pb-3">Cost</th>
              <th className="pb-3">Status</th>
              <th className="pb-3">Time</th>
            </tr>
          </thead>

          <tbody>
            {generations?.map((g: any) => (
              <tr key={g.id} className="border-t border-white/10">

                <td className="py-2 max-w-[400px] truncate">
                  {g.prompt}
                </td>

                <td className="py-2">
                  {g.cost} 🍌
                </td>

                <td className="py-2">
                  {g.status}
                </td>

                <td className="py-2">
                  {new Date(g.created_at).toLocaleString()}
                </td>

              </tr>
            ))}
          </tbody>

        </table>

      </div>

    </div>
  )
}

function Stat({ title, value }: any) {
  return (
    <div className="bg-[#0f0f0f] border border-white/10 rounded-xl p-4">
      <div className="text-white/50 text-sm">{title}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  )
}