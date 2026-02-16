import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { telegramUser } = body

    if (!telegramUser?.id) {
      return NextResponse.json({ error: 'No telegram user' }, { status: 400 })
    }

    const email = `telegram_${telegramUser.id}@telegram.local`
    const password = `secure_${telegramUser.id}`

    // Проверяем существует ли пользователь
    const { data: existingUser } =
      await supabaseAdmin.auth.admin.listUsers()

    const userFound = existingUser?.users?.find(
      (u) => u.email === email
    )

    let userId: string

    if (!userFound) {
      const { data: createdUser, error } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        })

      if (error || !createdUser.user) {
        return NextResponse.json({ error: 'User creation failed' }, { status: 500 })
      }

      userId = createdUser.user.id

      // Создаём профиль вручную
      await supabaseAdmin.from('profiles').insert({
        id: userId,
        balance: 0,
        telegram_id: telegramUser.id,
        telegram_username: telegramUser.username || null,
        telegram_first_name: telegramUser.first_name || null,
        telegram_avatar_url: telegramUser.photo_url || null,
      })
    } else {
      userId = userFound.id

      // Обновляем telegram данные
      await supabaseAdmin
        .from('profiles')
        .update({
          telegram_id: telegramUser.id,
          telegram_username: telegramUser.username || null,
          telegram_first_name: telegramUser.first_name || null,
          telegram_avatar_url: telegramUser.photo_url || null,
        })
        .eq('id', userId)
    }

    return NextResponse.json({ success: true })

  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}