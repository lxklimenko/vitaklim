import { NextResponse } from 'next/server';
import { YooCheckout } from '@a2seven/yoo-checkout';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;

    if (!shopId || !secretKey) {
      return NextResponse.json({ error: 'Missing YooKassa credentials' }, { status: 500 });
    }

    const checkout = new YooCheckout({ shopId, secretKey });
    const body = await req.json();
    const { amount, telegramUserId } = body;

    let userId: string | null = null;
    let userEmail: string | null = null;

    // 1️⃣ Если запрос из Telegram
    if (telegramUserId) {
      // Важно: выбираем и id, и email (если он есть в профиле)
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, email") 
        .eq("telegram_id", telegramUserId)
        .maybeSingle();

      if (!profile) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      userId = profile.id;
      // Если в таблице profiles нет email, создаем технический (как в твоем боте)
      userEmail = profile.email || `telegram_${telegramUserId}@klex.pro`;
    } 
    // 2️⃣ Если запрос с сайта
    else {
      const { createRouteHandlerClient } = require('@supabase/auth-helpers-nextjs');
      const { cookies } = require('next/headers');
      const supabaseRoute = createRouteHandlerClient({ cookies });
      const { data: { user } } = await supabaseRoute.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      userId = user.id;
      userEmail = user.email;
    }

    if (!amount || !userEmail) {
      return NextResponse.json({ error: 'Missing amount or email' }, { status: 400 });
    }

    const numericAmount = Number(amount);
    const idempotenceKey = randomUUID();

    const payment = await checkout.createPayment(
      {
        amount: {
          value: numericAmount.toFixed(2),
          currency: 'RUB',
        },
        confirmation: {
          type: 'redirect',
          return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/profile`,
        },
        capture: true,
        description: `Пополнение баланса: ${userId}`,
        metadata: { userId },
        // ✅ ДОБАВЛЕН ОБЪЕКТ RECEIPT С CUSTOMER
        receipt: {
          customer: {
            email: userEmail, // Теперь email передается обязательно
          },
          items: [
            {
              description: 'Пополнение баланса (бананы)',
              quantity: '1.00',
              amount: {
                value: numericAmount.toFixed(2),
                currency: 'RUB',
              },
              vat_code: 1, // Без НДС
              payment_subject: 'service',
              payment_mode: 'full_payment',
            },
          ],
          tax_system_code: 2, // 2 — УСН Доход (как мы выяснили раньше)
        },
      },
      idempotenceKey
    );

    return NextResponse.json({
      confirmationUrl: payment.confirmation?.confirmation_url,
    });
  } catch (error: any) {
    console.error('YooKassa Error:', error?.response?.data || error);
    return NextResponse.json(
      { error: error?.response?.data?.description || 'Payment creation failed' },
      { status: 500 }
    );
  }
}