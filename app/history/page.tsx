// app/history/page.tsx
import { createClient as createServerClient } from '@/app/lib/supabase-server'
import HistoryClient from './HistoryClient'

export default async function HistoryPage() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <HistoryClient initialGenerations={[]} />

  // Загружаем только первые 20 завершенных генераций
  const { data: generations } = await supabase
    .from('generations')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .range(0, 19) // 🔥 Лимит на сервере

  if (!generations || generations.length === 0) {
    return <HistoryClient initialGenerations={[]} />
  }

  const generationsWithPath = generations.filter((gen) => gen.storage_path)
  const paths = generationsWithPath.map((gen) => gen.storage_path)

  // Получаем Signed URLs только для этой пачки
  const { data: signedData } = await supabase.storage
    .from('generations-private')
    .createSignedUrls(paths, 3600)

  const generationsWithUrls = generationsWithPath.map((gen, index) => ({
    ...gen,
    image_url: signedData?.[index]?.signedUrl || null,
  })).filter(gen => gen.image_url !== null)

  return <HistoryClient initialGenerations={generationsWithUrls} />
}