export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { YooCheckout } from '@a2seven/yoo-checkout';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Инициализируем ЮKassa для проверки статуса
const checkout = new YooCheckout({
  shopId: process.env.YOOKASSA_SHOP_ID!,
  secretKey: process.env.YOOKASSA_SECRET_KEY!,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('📦 Webhook received:', body.event);

    // Берем ID платежа из уведомления
    const paymentId = body.object?.id;

    if (!paymentId) {
      return NextResponse.json({ error: 'No payment ID' }, { status: 400 });
    }

    // 🛡 ПРОВЕРКА ПОДЛИННОСТИ: Запрашиваем статус напрямую у ЮKassa
    const payment = await checkout.getPayment(paymentId);

    // Если ЮKassa подтверждает, что статус 'succeeded'
    if (payment.status === 'succeeded') {
      const userId = payment.metadata?.userId;
      const amount = Number(payment.amount?.value);

      if (!userId || !amount) {
        console.error('❌ Metadata missing in payment');
        return NextResponse.json({ error: 'Invalid metadata' }, { status: 400 });
      }

      // Проверяем, не обрабатывали ли мы этот платеж ранее
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id')
        .eq('yookassa_id', paymentId)
        .maybeSingle();

      if (existingPayment) {
        console.log('⚠️ Payment already processed');
        return NextResponse.json({ ok: true });
      }

      // Начисляем баланс через твою RPC функцию
      const { error: rpcError } = await supabase.rpc(
        'process_successful_payment',
        {
          p_user_id: userId,
          p_amount: amount,
          p_yookassa_id: paymentId
        }
      );

      if (rpcError) {
        console.error('❌ RPC error:', rpcError);
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
      }

      console.log('✅ Balance updated for user:', userId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error('🚨 Webhook fatal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}