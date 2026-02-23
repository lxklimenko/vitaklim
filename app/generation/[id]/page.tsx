import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import GenerationClient from './GenerationClient'

// Service role client (server only)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Props {
  params: { id: string }
}

export default async function GenerationPage({ params }: Props) {
  const cookieStore = await cookies()

  const accessToken = cookieStore.get('sb-access-token')?.value

  if (!accessToken) {
    notFound()
  }

  // Создаём обычный клиент для проверки пользователя
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken)

  if (!user || error) {
    notFound()
  }

  // Берём запись через service role
  const { data: generation } = await supabaseAdmin
    .from('generations')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!generation || generation.user_id !== user.id) {
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