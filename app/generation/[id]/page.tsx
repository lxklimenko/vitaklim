import { notFound } from 'next/navigation'
import { createClient } from '@/app/lib/supabase-server'
import { supabaseAdmin } from '@/app/lib/supabase-admin'
import GenerationClient from './GenerationClient'

export default async function GenerationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!id) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Загружаем генерацию через admin (без RLS)
  const { data: generation } = await supabaseAdmin
    .from('generations')
    .select('*, profiles(telegram_first_name, telegram_username, telegram_avatar_url)')
    .eq('id', id)
    .maybeSingle()

  if (!generation || !generation.storage_path) notFound()

  // Проверяем доступ:
  // - публичная генерация — видна всем
  // - приватная — только владельцу
  const isOwner = user?.id === generation.user_id
  const isPublic = generation.is_public

  if (!isPublic && !isOwner) notFound()

  // Генерируем signed URL
  const { data: signedData } = await supabaseAdmin.storage
    .from('generations-private')
    .createSignedUrl(generation.storage_path, 3600)

  if (!signedData?.signedUrl) notFound()

  // Получаем профиль автора
  const profiles = generation.profiles
  const authorProfile = Array.isArray(profiles) ? profiles[0] : profiles

  return (
    <GenerationClient
      imageUrl={signedData.signedUrl}
      prompt={generation.prompt}
      isOwner={isOwner}
      authorName={authorProfile?.telegram_first_name || authorProfile?.telegram_username || null}
      authorAvatar={authorProfile?.telegram_avatar_url || null}
      authorId={generation.user_id}
    />
  )
}