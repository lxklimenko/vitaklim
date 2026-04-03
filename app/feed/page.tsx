import { supabaseAdmin } from '@/app/lib/supabase-admin'
import FeedClient from './FeedClient'

export const dynamic = 'force-dynamic'

export default async function FeedPage() {
  const { data: generations, error } = await supabaseAdmin
    .from('generations')
    .select('id, image_url, storage_path, prompt, created_at, user_id')
    .eq('is_public', true)
    .eq('status', 'completed')
    .not('image_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) console.error('FEED error:', error)

  const userIds = [...new Set((generations || []).map(g => g.user_id))]
  
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, telegram_first_name, telegram_username, telegram_avatar_url')
    .in('id', userIds.length > 0 ? userIds : ['none'])

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))

  // Обновляем signed URLs для картинок из приватного бакета
  const mapped = await Promise.all((generations || []).map(async (g) => {
    let imageUrl = g.image_url

    // Если есть storage_path — генерируем свежий signed URL
    if (g.storage_path) {
      const { data: signedData } = await supabaseAdmin.storage
        .from('generations-private')
        .createSignedUrl(g.storage_path, 60 * 60) // 1 час

      if (signedData?.signedUrl) {
        imageUrl = signedData.signedUrl
      }
    }

    return {
      ...g,
      image_url: imageUrl,
      profiles: profileMap[g.user_id] ?? null,
    }
  }))

  return <FeedClient generations={mapped} />
}