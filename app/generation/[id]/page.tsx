import { createClient } from '@/app/lib/supabase-server'
import { notFound } from 'next/navigation'
import GenerationClient from './GenerationClient'

interface Props {
  params: { id: string }
}

export default async function GenerationPage({ params }: Props) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    notFound()
  }

  const { data: generation } = await supabase
    .from('generations')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id) // 🔒 защита: только владелец
    .maybeSingle()

  if (!generation || !generation.storage_path) {
    notFound()
  }

  // 🔒 Генерируем signed URL
  const { data: signedData, error: signedError } =
    await supabase.storage
      .from('generations-private')
      .createSignedUrl(generation.storage_path, 3600)

  if (signedError || !signedData?.signedUrl) {
    console.error('Signed URL error:', signedError)
    notFound()
  }

  return (
    <GenerationClient
      imageUrl={signedData.signedUrl}
      prompt={generation.prompt}
    />
  )
}