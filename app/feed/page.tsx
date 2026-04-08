import { supabaseAdmin } from '@/app/lib/supabase-admin'
import FeedClient from './FeedClient'

export const dynamic = 'force-dynamic'

async function getSignedUrl(storagePath: string) {
  const { data } = await supabaseAdmin.storage
    .from('generations-private')
    .createSignedUrl(storagePath, 60 * 60)
  return data?.signedUrl || null
}

export default async function FeedPage() {
  // Новые генерации
  const { data: newGenerations } = await supabaseAdmin
    .from('generations')
    .select('id, image_url, storage_path, prompt, created_at, user_id')
    .eq('is_public', true)
    .eq('status', 'completed')
    .not('image_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(30)

  // Топ по лайкам за последние 7 дней
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  const { data: topGenerations } = await supabaseAdmin
    .from('generations')
    .select('id, image_url, storage_path, prompt, created_at, user_id')
    .eq('is_public', true)
    .eq('status', 'completed')
    .not('image_url', 'is', null)
    .gte('created_at', weekAgo.toISOString())
    .limit(50)

  // Загружаем лайки для топа
  const topIds = (topGenerations || []).map(g => g.id)
  const { data: likesData } = await supabaseAdmin
    .from('likes')
    .select('generation_id')
    .in('generation_id', topIds.length > 0 ? topIds : ['none'])

  const likesCount: Record<string, number> = {}
  likesData?.forEach(l => {
    likesCount[l.generation_id] = (likesCount[l.generation_id] || 0) + 1
  })

  // Сортируем топ по лайкам
  const sortedTop = (topGenerations || [])
    .sort((a, b) => (likesCount[b.id] || 0) - (likesCount[a.id] || 0))
    .slice(0, 30)

  // Загружаем профили
  const allGenerations = [...(newGenerations || []), ...sortedTop]
  const userIds = [...new Set(allGenerations.map(g => g.user_id))]

  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, telegram_first_name, telegram_username, telegram_avatar_url')
    .in('id', userIds.length > 0 ? userIds : ['none'])

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))

  // Обновляем signed URLs
  const mapGenerations = async (gens: any[]) =>
    Promise.all(gens.map(async (g) => {
      let imageUrl = g.image_url
      if (g.storage_path) {
        const signed = await getSignedUrl(g.storage_path)
        if (signed) imageUrl = signed
      }
      return { ...g, image_url: imageUrl, profiles: profileMap[g.user_id] ?? null }
    }))

  const [mappedNew, mappedTop] = await Promise.all([
    mapGenerations(newGenerations || []),
    mapGenerations(sortedTop),
  ])

  return <FeedClient newGenerations={mappedNew} topGenerations={mappedTop} />
}