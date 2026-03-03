import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/app/lib/supabase-admin'

// Валидация данных от Mini App (initData)
function validateTelegramInitData(initData: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) throw new Error('BOT TOKEN not configured')

  const urlParams = new URLSearchParams(initData)
  const hash = urlParams.get('hash')
  if (!hash) return null

  urlParams.delete('hash')
  const dataCheckString = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secretKey = crypto.createHash('sha256').update(botToken).digest()
  const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  if (hmac !== hash) return null

  const userString = urlParams.get('user')
  return userString ? JSON.parse(userString) : null
}

// Валидация данных от Виджета (widgetData)
function validateWidgetData(data: any) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) throw new Error('BOT TOKEN not configured')

  const { hash, ...user } = data
  if (!hash) return null

  // 1. Строка проверки: ключи в алфавитном порядке, только непустые значения
  const checkString = Object.keys(user)
    .sort()
    .map(key => `${key}=${user[key]}`)
    .join('\n')

  const secretKey = crypto.createHash('sha256').update(botToken).digest()
  const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex')

  if (hmac !== hash) return null

  // Проверка на устаревание (24 часа)
  if (user.auth_date) {
    const now = Math.floor(Date.now() / 1000)
    if (now - parseInt(user.auth_date) > 86400) return null
  }

  return user
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { initData, widgetData } = body

    let telegramUser: any = null

    if (initData) {
      telegramUser = validateTelegramInitData(initData)
    } else if (widgetData) {
      telegramUser = validateWidgetData(widgetData)
    }

    if (!telegramUser?.id) {
      return NextResponse.json({ error: 'Invalid Telegram data' }, { status: 401 })
    }

    // Тот же формат, что на фронтенде
    const email = `telegram_${telegramUser.id}@telegram.local`
    const password = `secure_${telegramUser.id}`

    // Проверяем существование пользователя
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    const userFound = users?.find((u) => u.email === email)

    let userId: string

    if (!userFound) {
      // СОЗДАЕМ НОВОГО
      const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

      if (createError || !createdUser.user) {
        console.error('User creation error:', createError)
        return NextResponse.json({ error: 'User creation failed' }, { status: 500 })
      }

      userId = createdUser.user.id

      // Создаем профиль с начальным балансом (например, 5 кредитов в подарок)
      await supabaseAdmin.from('profiles').insert({
        id: userId,
        balance: 5, 
        telegram_id: telegramUser.id,
        telegram_username: telegramUser.username || null,
        telegram_first_name: telegramUser.first_name || null,
        telegram_avatar_url: telegramUser.photo_url || telegramUser.avatar_url || null,
      })
    } else {
      // ОБНОВЛЯЕМ СУЩЕСТВУЮЩЕГО
      userId = userFound.id
      await supabaseAdmin
        .from('profiles')
        .update({
          telegram_username: telegramUser.username || null,
          telegram_first_name: telegramUser.first_name || null,
          telegram_avatar_url: telegramUser.photo_url || telegramUser.avatar_url || null,
        })
        .eq('id', userId)
    }

    // Возвращаем успех
    return NextResponse.json({ success: true, userId })

  } catch (err) {
    console.error('Auth API Error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}