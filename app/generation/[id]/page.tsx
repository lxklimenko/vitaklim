import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import GenerationClient from './GenerationClient'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export default async function GenerationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  console.log("PARAM ID:", id)

  if (!id) {
    notFound()
  }

  const { data: generation, error } = await supabaseAdmin
    .from('generations')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  console.log("GENERATION:", generation)
  console.log("ERROR:", error)

  if (!generation || !generation.storage_path) {
    notFound()
  }

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