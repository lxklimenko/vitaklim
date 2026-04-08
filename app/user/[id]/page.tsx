import { supabaseAdmin } from '@/app/lib/supabase-admin'
import { notFound } from 'next/navigation'
import UserProfileClient from './UserProfileClient'

export const dynamic = 'force-dynamic'

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, telegram_first_name, telegram_username, telegram_avatar_url, created_at')
    .eq('id', id)
    .single()

  if (!profile) notFound()

  const { data: generations } = await supabaseAdmin
    .from('generations')
    .select('id, image_url, storage_path, prompt, created_at')
    .eq('user_id', id)
    .eq('is_public', true)
    .eq('status', 'completed')
    .not('image_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(30)

  // Обновляем signed URLs
  const mapped = await Promise.all((generations || []).map(async (g) => {
    let imageUrl = g.image_url
    if (g.storage_path) {
      const { data: signedData } = await supabaseAdmin.storage
        .from('generations-private')
        .createSignedUrl(g.storage_path, 60 * 60)
      if (signedData?.signedUrl) imageUrl = signedData.signedUrl
    }
    return { ...g, image_url: imageUrl }
  }))

  return (
    <UserProfileClient
      profile={profile}
      generations={mapped}
    />
  )
}