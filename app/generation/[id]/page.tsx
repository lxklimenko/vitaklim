import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import GenerationClient from './GenerationClient'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Props {
  params: { id: string }
}

export default async function GenerationPage({ params }: Props) {
  const { data: generation } = await supabaseAdmin
    .from('generations')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!generation || !generation.storage_path) {
    notFound()
  }

  // Генерируем signed URL
  const { data: signedData } =
    await supabaseAdmin.storage
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