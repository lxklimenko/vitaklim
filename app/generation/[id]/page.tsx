import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import GenerationClient from './GenerationClient'

// Initialize Supabase client with service role (server-only)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Props {
  params: Promise<{ id: string }>
}

export default async function GenerationPage({ params }: Props) {
  // 1. Await the params to get the id
  const { id } = await params

  // 2. Fetch generation data from Supabase
  const { data: generation } = await supabase
    .from('generations')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  // 🔍 Логи для отладки
  console.log("PARAM ID:", id)
  console.log("DB RESULT:", generation)

  // 3. Handle missing generation or image URL
  if (!generation || !generation.image_url) {
    notFound()
  }

  return (
    <GenerationClient
      imageUrl={generation.image_url}
      prompt={generation.prompt}
    />
  )
}