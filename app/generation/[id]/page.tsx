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
  if (!id) { console.log('NO ID'); notFound() }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  console.log('USER:', user?.id)

  const { data: generation, error } = await supabaseAdmin
    .from('generations')
    .select('id, prompt, storage_path, is_public, user_id')
    .eq('id', id)
    .maybeSingle()

  console.log('GENERATION:', generation?.id, 'ERROR:', error?.message)

  if (!generation) { console.log('NO GENERATION'); notFound() }
  if (!generation.storage_path) { console.log('NO STORAGE PATH'); notFound() }

  const isOwner = user?.id === generation.user_id
  const isPublic = generation.is_public

  console.log('isOwner:', isOwner, 'isPublic:', isPublic)

  if (!isPublic && !isOwner) { console.log('ACCESS DENIED'); notFound() }

  const { data: signedData, error: signedError } = await supabaseAdmin.storage
    .from('generations-private')
    .createSignedUrl(generation.storage_path, 3600)

  console.log('SIGNED URL:', !!signedData?.signedUrl, 'ERROR:', signedError?.message)

  if (!signedData?.signedUrl) { console.log('NO SIGNED URL'); notFound() }

  return (
    <GenerationClient
      imageUrl={signedData.signedUrl}
      prompt={generation.prompt}
      isOwner={isOwner}
      authorName={null}
      authorAvatar={null}
      authorId={generation.user_id}
    />
  )
}