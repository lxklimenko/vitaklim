import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('u')
  const offset = parseInt(searchParams.get('offset') || '0')

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
  }

  // Подключаемся к базе как админ, чтобы отдать картинки гостю по ссылке
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { data: generations, error } = await supabase
      .from('generations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + 9) // Грузим по 10 штук

    if (error) throw error

    return NextResponse.json({
      generations,
      hasMore: generations.length === 10
    })
  } catch (error) {
    console.error('Guest history error:', error)
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}