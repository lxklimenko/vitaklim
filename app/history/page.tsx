import { createClient as createServerClient } from '@/app/lib/supabase-server'
import HistoryClient from './HistoryClient'

export default async function HistoryPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return <HistoryClient initialGenerations={[]} />
  }

  const { data: generations } = await supabase
    .from('generations')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  if (!generations) {
    return <HistoryClient initialGenerations={[]} />
  }

  // Собираем пути файлов
  const generationsWithPath = generations.filter((gen) => gen.storage_path)
  const paths = generationsWithPath.map((gen) => gen.storage_path)

  if (paths.length === 0) {
    return <HistoryClient initialGenerations={[]} />
  }

  // Запрашиваем signed URLs одним запросом
  const { data: signedData, error } = await supabase.storage
    .from('generations-private')
    .createSignedUrls(paths, 3600)

  if (error || !signedData) {
    console.error('Error creating signed URLs:', error)
    return <HistoryClient initialGenerations={[]} />
  }

  // Объединяем данные, сохраняя только те, для которых удалось получить URL
  const generationsWithUrls = generationsWithPath
    .map((gen, index) => ({
      ...gen,
      image_url: signedData[index]?.signedUrl || null,
    }))
    .filter((gen) => gen.image_url !== null)

  return <HistoryClient initialGenerations={generationsWithUrls} />
}