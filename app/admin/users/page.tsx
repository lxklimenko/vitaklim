export const dynamic = "force-dynamic"

import { supabaseAdmin } from '@/app/lib/supabase-admin'

export default async function AdminUsersPage() {

  console.log("SERVICE ROLE:", process.env.SUPABASE_SERVICE_ROLE_KEY)

  const supabase = supabaseAdmin

  // Запрос с выборкой нужных полей, подсчётом общего количества и сортировкой
  const { data: users, error, count } = await supabase
    .from('admin_users_view')
    .select(`
      id,
      telegram_username,
      telegram_first_name,
      telegram_avatar_url,
      balance,
      referrals_count,
      created_at,
      generations,
      spent
    `, { count: "exact" })
    .order('created_at', { ascending: false })

  console.log("ADMIN USERS:", users)
  console.log("ADMIN ERROR:", error)

  // Если произошла ошибка, показываем сообщение
  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-10">
        <h1 className="text-3xl font-bold mb-4">Ошибка загрузки пользователей</h1>
        <pre className="bg-red-900/20 p-4 rounded border border-red-500/30">
          {JSON.stringify(error, null, 2)}
        </pre>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-10">

      <h1 className="text-3xl font-bold mb-10">
        Users <span className="text-white/40">({count})</span>
      </h1>

      {/* Контейнер с overflow-x-auto и тонким скроллом */}
      <div className="bg-[#141414] border border-white/10 rounded-2xl p-6 overflow-x-auto scrollbar-thin">

        {/* Таблица с минимальной шириной для корректного скролла на мобильных */}
        <table className="min-w-[1000px] w-full text-left">

          <thead>
            <tr className="text-white/50">
              <th className="pb-4">User</th>
              <th className="pb-4">Username</th>
              <th className="pb-4">Name</th>
              <th className="pb-4">Balance</th>
              <th className="pb-4">Generations</th>
              <th className="pb-4">Spent</th>
              <th className="pb-4">Referrals</th>
              <th className="pb-4">Created</th>
            </tr>
          </thead>

          <tbody>

            {users?.map((u: any) => (

              <tr key={u.id} className="border-t border-white/10">

                <td className="py-3">
                  {u.telegram_avatar_url ? (
                    <img
                      src={u.telegram_avatar_url}
                      className="w-8 h-8 rounded-full"
                      alt="avatar"
                    />
                  ) : (
                    "👤"
                  )}
                </td>

                <td className="py-3">
                  <a
                    href={`/admin/users/${u.id}`}
                    className="hover:underline text-blue-400"
                  >
                    @{u.telegram_username || "no_username"}
                  </a>
                </td>

                <td className="py-3">
                  {u.telegram_first_name}
                </td>

                <td className="py-3 font-semibold">
                  {u.balance} 🍌
                </td>

                <td className="py-3">
                  {u.generations || 0}
                </td>

                <td className="py-3 font-semibold">
                  {u.spent || 0} 🍌
                </td>

                <td className="py-3">
                  {u.referrals_count}
                </td>

                <td className="py-3">
                  {u.created_at
                    ? new Date(u.created_at).toLocaleDateString()
                    : "-"}
                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  )
}