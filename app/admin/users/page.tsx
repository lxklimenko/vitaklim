import { supabaseAdmin } from '@/app/lib/supabase-admin'

export default async function AdminUsersPage() {

  console.log("SERVICE ROLE:", process.env.SUPABASE_SERVICE_ROLE_KEY)

  const supabase = supabaseAdmin

  const { data: users } = await supabase
    .from('profiles')
    .select(`
      id,
      telegram_username,
      telegram_first_name,
      telegram_avatar_url,
      balance,
      referrals_count,
      created_at
    `)
    .order('created_at', { ascending: false })

  console.log("ADMIN USERS:", users)

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-10">

      <h1 className="text-3xl font-bold mb-10">
        Users
      </h1>

      <div className="bg-[#141414] border border-white/10 rounded-2xl p-6">

        <table className="w-full text-left">

          <thead>
            <tr className="text-white/50">
              <th className="pb-4">User</th>
              <th className="pb-4">Username</th>
              <th className="pb-4">Name</th>
              <th className="pb-4">Balance</th>
              <th className="pb-4">Referrals</th>
              <th className="pb-4">Created</th>
            </tr>
          </thead>

          <tbody>

            {users?.map((u:any) => (

              <tr key={u.id} className="border-t border-white/10">

                <td className="py-3">

                  {u.telegram_avatar_url ? (
                    <img
                      src={u.telegram_avatar_url}
                      className="w-8 h-8 rounded-full"
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
                    @{u.telegram_username}
                  </a>
                </td>

                <td className="py-3">
                  {u.telegram_first_name}
                </td>

                <td className="py-3 font-semibold">
                  {u.balance} 🍌
                </td>

                <td className="py-3">
                  {u.referrals_count}
                </td>

                <td className="py-3">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </div>
  )
}