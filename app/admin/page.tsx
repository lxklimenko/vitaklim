import { createClient } from '@/app/lib/supabase-server'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div className="p-20 bg-red-900 text-white">❌ Ошибка: Вы не авторизованы. Сессия не найдена.</div>
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="p-20 bg-slate-900 text-white font-mono">
      <h1 className="text-2xl mb-4">🔍 Диагностика доступа</h1>
      <p>Твой текущий ID: <span className="text-yellow-400">{user.id}</span></p>
      <p>Твой Email: <span className="text-yellow-400">{user.email}</span></p>
      <hr className="my-4 opacity-20" />
      <p>Статус в таблице profiles:</p>
      <pre className="bg-black p-4 mt-2">
        {JSON.stringify(profile, null, 2)}
      </pre>
      {!profile?.is_admin && (
        <p className="mt-4 text-red-500">🛑 ВНИМАНИЕ: В колонке is_admin стоит false или пусто!</p>
      )}
    </div>
  )
}