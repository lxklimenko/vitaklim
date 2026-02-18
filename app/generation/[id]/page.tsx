import { createClient } from '@supabase/supabase-js'
import Image from 'next/image'
import { notFound } from 'next/navigation'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Props {
  params: { id: string }
}

export default async function GenerationPage({ params }: Props) {

  const { data: generation } = await supabase
    .from('generations')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!generation) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 pt-6">
        <div className="relative w-full aspect-[4/5] rounded-3xl overflow-hidden bg-zinc-900">
          <Image
            src={generation.image_url}
            alt="Generated"
            fill
            className="object-contain"
          />
        </div>
      </div>
    </div>
  )
}
