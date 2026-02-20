import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/app/lib/supabase-admin'

function validateTelegramInitData(initData: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN!
  if (!botToken) throw new Error('BOT TOKEN not configured')

  const urlParams = new URLSearchParams(initData)
  const hash = urlParams.get('hash')

  if (!hash) return null

  urlParams.delete('hash')

  const dataCheckString = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secretKey = crypto
    .createHash('sha256')
    .update(botToken)
    .digest()

  const hmac = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  if (hmac !== hash) {
    return null
  }

  const userString = urlParams.get('user')
  if (!userString) return null

  return JSON.parse(userString)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { initData } = body

    if (!initData) {
      return NextResponse.json({ error: 'No initData' }, { status: 400 })
    }

    const telegramUser = validateTelegramInitData(initData)

    if (!telegramUser?.id) {
      return NextResponse.json({ error: 'Invalid Telegram data' }, { status: 401 })
    }

    const email = `telegram_${telegramUser.id}@telegram.local`
    const password = `secure_${telegramUser.id}`

    const { data: existingUsers } =
      await supabaseAdmin.auth.admin.listUsers()

    const userFound = existingUsers?.users?.find(
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
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}