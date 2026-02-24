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

  // 🔥 создаём signed URLs
  const generationsWithUrls = await Promise.all(
    generations.map(async (gen) => {
      if (!gen.storage_path) return null

      const { data } = await supabase.storage
        .from('generations-private')
        .createSignedUrl(gen.storage_path, 3600)

      if (!data?.signedUrl) return null

      return {
        ...gen,
        image_url: data.signedUrl,
      }
    })
  )

  const filtered = generationsWithUrls.filter(Boolean)

  return <HistoryClient initialGenerations={filtered} />
}