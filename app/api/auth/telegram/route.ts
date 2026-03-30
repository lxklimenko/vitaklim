import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/app/lib/supabase-admin'

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

function validateWidgetData(data: any) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) throw new Error('BOT TOKEN not configured')

  const { hash, ...user } = data
  if (!hash) return null

  const checkString = Object.keys(user)
    .sort()
    .map(key => `${key}=${user[key]}`)
    .join('\n')

  const secretKey = crypto.createHash('sha256').update(botToken).digest()
  const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex')

  if (hmac !== hash) return null

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
    if (initData) telegramUser = validateTelegramInitData(initData)
    else if (widgetData) telegramUser = validateWidgetData(widgetData)

    if (!telegramUser?.id) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 401 })
    }

    const email = `telegram_${telegramUser.id}@telegram.local`
    const password = `secure_${telegramUser.id}`

    let userId!: string

    // Шаг 1: пробуем создать пользователя
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (!createError && created.user) {
      // Новый пользователь — успешно создан
      userId = created.user.id
    } else if ((createError as any)?.code === 'email_exists') {
      // Пользователь уже есть — ищем его ID через таблицу profiles по telegram_id
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('telegram_id', telegramUser.id)
        .maybeSingle()

      if (profile?.id) {
        userId = profile.id
      } else {
        // Профиля нет — ищем через listUsers с пагинацией
        let found = false
        let page = 1
        while (!found) {
          const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({
            page,
            perPage: 1000,
          })
          if (error || !users?.length) break
          const match = users.find(u => u.email === email)
          if (match) {
            userId = match.id
            found = true
          } else if (users.length < 1000) {
            break
          }
          page++
        }
        if (!found) throw new Error('User not found after email_exists error')
      }
    } else {
      console.error('createUser failed:', JSON.stringify(createError))
      throw new Error('Auth creation failed')
    }

    // Шаг 2: обновляем или создаём профиль
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('telegram_id', telegramUser.id)
      .maybeSingle()

    if (existingProfile) {
      await supabaseAdmin
        .from('profiles')
        .update({
          id: userId,
          telegram_username: telegramUser.username || null,
          telegram_first_name: telegramUser.first_name || null,
          telegram_avatar_url: telegramUser.photo_url || null,
        })
        .eq('telegram_id', telegramUser.id)
    } else {
      await supabaseAdmin.from('profiles').insert({
        id: userId,
        telegram_id: telegramUser.id,
        balance: 1,
        telegram_username: telegramUser.username || null,
        telegram_first_name: telegramUser.first_name || null,
        telegram_avatar_url: telegramUser.photo_url || null,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Telegram auth error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}