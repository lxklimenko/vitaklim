import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('u')
  const offset = parseInt(searchParams.get('offset') || '0')

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
  }

  // Подключаемся как админ, чтобы читать чужую историю по ссылке
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { data: generations, error } = await supabase
      .from('generations')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed') // 🔥 Забираем только успешно сгенерированные
      .order('created_at', { ascending: false })
      .range(offset, offset + 9) // Грузим по 10 штук

    if (error || !generations || generations.length === 0) {
      return NextResponse.json({ generations: [], hasMore: false })
    }

    // --- НАЧАЛО МАГИИ ССЫЛОК ---
    // 1. Собираем все пути к файлам
    const paths = generations
      .map((g) => g.storage_path)
      .filter((path): path is string => !!path)

    // 2. Выписываем временные пропуска (Signed URLs) на 1 час
    const { data: signedData } = await supabase.storage
      .from('generations-private')
      .createSignedUrls(paths, 3600)

    // 3. Приклеиваем эти пропуска к нашим картинкам
    const result = generations.map((gen, index) => ({
      ...gen,
      image_url: signedData?.[index]?.signedUrl || null,
    }))
    // --- КОНЕЦ МАГИИ ССЫЛОК ---

    return NextResponse.json({
      generations: result,
      hasMore: generations.length === 10
    })
  } catch (error) {
    console.error('Guest history error:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}