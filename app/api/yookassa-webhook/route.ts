import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get('content-hmac')

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 401 })
    }

    const secret = process.env.YOOKASSA_WEBHOOK_SECRET!

    const hash = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')

    if (hash !== signature) {
      console.error('Invalid webhook signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const body = JSON.parse(rawBody)

    // Более строгая проверка: событие должно быть payment.succeeded И статус платежа должен быть succeeded
    if (
      body.event !== 'payment.succeeded' ||
      body.object?.status !== 'succeeded'
    ) {
      return NextResponse.json({ ok: true })
    }

    const payment = body.object
    const userId = payment.metadata?.userId
    const amount = Number(payment.amount?.value)
    const yookassaId = payment.id

    if (!userId || !amount || !yookassaId) {
      return NextResponse.json({ error: 'Invalid metadata' }, { status: 400 })
    }

    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('yookassa_id', yookassaId)
      .maybeSingle()

    if (existingPayment) {
      return NextResponse.json({ ok: true })
    }

    await supabase.rpc('process_successful_payment', {
      p_user_id: userId,
      p_amount: amount,
      p_yookassa_id: yookassaId
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}