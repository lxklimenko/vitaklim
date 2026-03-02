import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase-server'
import { Generation } from '@/app/types'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const offset = parseInt(searchParams.get('offset') || '0')
  const limit = 10 // изменено с 20 на 10

  // Читаем параметр 'u' (guest user id)
  const guestUserId = searchParams.get('u')

  let targetUserId: string

  if (guestUserId) {
    // Если передан guestUserId, используем его как целевой ID
    targetUserId = guestUserId
  } else {
    // Иначе пытаемся получить текущего аутентифицированного пользователя
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    targetUserId = user.id
  }

  const { data: generations, error: queryError } = await supabase
    .from('generations')
    .select('*')
    .eq('user_id', targetUserId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (queryError || !generations || generations.length === 0) {
    return NextResponse.json({ generations: [], hasMore: false })
  }

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