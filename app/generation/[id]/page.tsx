import { createClient } from '@supabase/supabase-js'
import Image from 'next/image'
import { notFound } from 'next/navigation'

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
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 pt-6">
        {/* Optional title or metadata */}
        {generation.prompt && (
          <h1 className="text-xl font-medium mb-4 text-center text-gray-200">
            {generation.prompt}
          </h1>
        )}

        {/* Image container with proper aspect ratio */}
        <div className="relative w-full aspect-[4/5] rounded-3xl overflow-hidden bg-zinc-900">
          <Image
            src={generation.image_url}
            alt={generation.prompt || 'Generated image'}
            fill
            className="object-contain"
            priority
          />
        </div>
      </div>
    </div>
  )
}