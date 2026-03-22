import { NextResponse } from 'next/server';
import { YooCheckout } from '@a2seven/yoo-checkout';
import { randomUUID } from 'crypto';

const checkout = new YooCheckout({
  shopId: process.env.YOOKASSA_SHOP_ID!,
  secretKey: process.env.YOOKASSA_SECRET_KEY!,
});

export async function POST(req: Request) {
  try {
    const { amount, telegramUserId, email } = await req.json();

    const payment = await checkout.createPayment({
      amount: {
        value: amount.toFixed(2),
        currency: 'RUB',
      },
      payment_method_data: {
        type: 'bank_card',
      },
      confirmation: {
        type: 'redirect',
        return_url: process.env.NEXT_PUBLIC_SITE_URL || 'https://klex.pro',
      },
      description: `Пополнение баланса KLEX`,
      metadata: {
        userId: telegramUserId,
      },
      receipt: {
        customer: { email },
        items: [
          {
            description: 'Пополнение баланса (бананы)',
            quantity: '1', // строка, как требуется
            amount: {
              value: amount.toFixed(2),
              currency: 'RUB',
            },
            vat_code: 1, // число
          },
        ],
      },
    }, randomUUID());

    return NextResponse.json({ confirmationUrl: payment.confirmation.confirmation_url });
  } catch (error: any) {
    console.error('YooKassa Create Error:', error);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}