import { createClient } from '@/app/lib/supabase-server'
import Image from 'next/image'
import { notFound } from 'next/navigation'

interface Props {
  params: { id: string }
}

export default async function GenerationPage({ params }: Props) {
  const supabase = await createClient()

  // 1. Проверяем, авторизован ли пользователь
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    notFound()
  }

  // 2. Запрашиваем запись, принадлежащую текущему пользователю
  const { data: generation } = await supabase
    .from('generations')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)   // добавляем фильтр по user_id
    .maybeSingle()             // используем maybeSingle вместо single

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