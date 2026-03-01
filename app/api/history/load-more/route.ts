import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase-server'
import { Generation } from '@/app/types' // Импортируем тип для типизации

export async function GET(req: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const offset = parseInt(searchParams.get('offset') || '0')
  const limit = 20

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 1. Исправлено: убран дубликат .from()
  const { data: generations, error: queryError } = await supabase
    .from('generations')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (queryError || !generations || generations.length === 0) {
    return NextResponse.json({ generations: [], hasMore: false })
  }

  // 2. Исправлено: добавлены типы для параметров 'g', 'gen' и 'index'
  const paths = (generations as Generation[])
    .map((g: Generation) => g.storage_path)
    .filter((path): path is string => !!path)

  const { data: signedData } = await supabase.storage
    .from('generations-private')
    .createSignedUrls(paths, 3600)

  const result = (generations as Generation[]).map((gen: Generation, index: number) => ({
    ...gen,
    image_url: signedData?.[index]?.signedUrl || null,
  }))

  return NextResponse.json({ 
    generations: result, 
    hasMore: generations.length === limit 
  })
}