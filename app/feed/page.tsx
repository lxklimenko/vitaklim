import { supabaseAdmin } from '@/app/lib/supabase-admin'
import FeedClient from './FeedClient'

export const dynamic = 'force-dynamic'

export default async function FeedPage() {
  const { data: generations, error } = await supabaseAdmin
    .from('generations')
    .select('id, image_url, prompt, created_at, user_id')
    .eq('is_public', true)
    .eq('status', 'completed')
    .not('image_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) console.error('FEED error:', error)

  // Загружаем профили отдельно
  const userIds = [...new Set((generations || []).map(g => g.user_id))]
  
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, telegram_first_name, telegram_username, telegram_avatar_url')
    .in('id', userIds)

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))

  const mapped = (generations || []).map(g => ({
    ...g,
    profiles: profileMap[g.user_id] ?? null,
  }))

  return <FeedClient generations={mapped} />
}