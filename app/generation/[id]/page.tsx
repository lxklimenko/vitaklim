import { notFound } from 'next/navigation'
import { createClient } from '@/app/lib/supabase-server'
import GenerationClient from './GenerationClient'

export default async function GenerationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  if (!id) {
    notFound()
  }

  const supabase = await createClient()

  // 🔐 Получаем текущего пользователя
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    notFound()
  }

  // 🔐 Получаем только СВОЮ генерацию (RLS + проверка user_id)
  const { data: generation, error } = await supabase
    .from('generations')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!generation || !generation.storage_path) {
    notFound()
  }

  // 🔐 Генерируем signed URL
  const { data: signedData } = await supabase.storage
    .from('generations-private')
    .createSignedUrl(generation.storage_path, 3600)

  if (!signedData?.signedUrl) {
    notFound()
  }

  return (
    <GenerationClient
      imageUrl={signedData.signedUrl}
      prompt={generation.prompt}
    />
  )
}