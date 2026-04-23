import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase-server'
import { supabaseAdmin } from '@/app/lib/supabase-admin'
import { syncProfile } from '@/app/lib/vps-sync'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!

async function sendTelegramMessage(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown'
    })
  })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, amount, message } = await req.json()
  if (!userId || !amount || amount <= 0) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
  }

  // Начисляем бананы
  const { error } = await supabaseAdmin.rpc('increment_balance', {
    user_id: userId,
    amount_to_add: amount
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await syncProfile(supabaseAdmin, userId)

  // Получаем telegram_id пользователя
  const { data: targetProfile } = await supabaseAdmin
    .from('profiles')
    .select('telegram_id, balance')
    .eq('id', userId)
    .single()

  // Отправляем уведомление в Telegram если есть telegram_id
  if (targetProfile?.telegram_id) {
    const newBalance = (targetProfile.balance || 0) + amount
    const adminMessage = message?.trim()
      ? `\n\n💬 *Сообщение от администратора:*\n${message}`
      : ''

    await sendTelegramMessage(
      targetProfile.telegram_id,
      `🎁 *Вам начислено ${amount} 🍌!*\n\nВаш новый баланс: *${newBalance} 🍌*${adminMessage}`
    )
  }

  return NextResponse.json({ success: true })
}
