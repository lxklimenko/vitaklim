import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ⚠️ только service role!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()

    console.log('YooKassa webhook:', body)

    // Проверяем что это успешная оплата
    if (body.event !== 'payment.succeeded') {
      return NextResponse.json({ ok: true })
    }

    const payment = body.object
    const userId = payment.metadata?.userId
    const amount = Number(payment.amount?.value)

    if (!userId || !amount) {
      console.error('Missing metadata')
      return NextResponse.json({ error: 'Invalid metadata' }, { status: 400 })
    }

    // 🔥 Увеличиваем баланс
    const { data, error } = await supabase.rpc('increment_balance', {
      user_id: userId,
      amount_to_add: amount
    })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }

    console.log(`Balance updated for ${userId}`)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
