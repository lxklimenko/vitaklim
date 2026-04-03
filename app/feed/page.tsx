import { supabaseAdmin } from '@/app/lib/supabase-admin'
import FeedClient from './FeedClient'

export const dynamic = 'force-dynamic'

export default async function FeedPage() {
  const { data: generations } = await supabaseAdmin
    .from('generations')
    .select(`
      id,
      image_url,
      prompt,
      created_at,
      user_id,
      profiles (
        telegram_first_name,
        telegram_username,
        telegram_avatar_url
      )
    `)
    .eq('is_public', true)
    .eq('status', 'completed')
    .not('image_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(30)

  const mapped = (generations || []).map((g: any) => ({
    ...g,
    profiles: Array.isArray(g.profiles) ? g.profiles[0] ?? null : g.profiles,
  }))

  return <FeedClient generations={mapped} />
}