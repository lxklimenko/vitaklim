import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()

    console.log('YooKassa webhook:', body)

    if (body.event !== 'payment.succeeded') {
      return NextResponse.json({ ok: true })
    }

    const payment = body.object
    const userId = payment.metadata?.userId
    const amount = Number(payment.amount?.value)
    const yookassaId = payment.id

    if (!userId || !amount || !yookassaId) {
      console.error('Missing metadata')
      return NextResponse.json({ error: 'Invalid metadata' }, { status: 400 })
    }

    // 🔐 Проверяем, не обработан ли уже этот платеж
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('yookassa_id', yookassaId)
      .single()

    if (existingPayment) {
      console.log('Payment already processed')
      return NextResponse.json({ ok: true })
    }

    // 💾 Сохраняем платеж
    const { error: insertError } = await supabase
      .from('payments')
      .insert({
        user_id: userId,
        amount,
        status: 'succeeded',
        yookassa_id: yookassaId
      })

    if (insertError) {
      console.error('Insert payment error:', insertError)
      return NextResponse.json({ error: 'Insert failed' }, { status: 500 })
    }

    // 💰 Увеличиваем баланс
    const { error: balanceError } = await supabase.rpc('increment_balance', {
      user_id: userId,
      amount_to_add: amount
    })

    if (balanceError) {
      console.error('Balance update error:', balanceError)
      return NextResponse.json({ error: 'Balance update failed' }, { status: 500 })
    }

    console.log(`Balance updated for ${userId}`)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
