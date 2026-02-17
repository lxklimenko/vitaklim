import { NextResponse } from 'next/server';
import { YooCheckout } from '@a2seven/yoo-checkout';
import { randomUUID } from 'crypto'; // Available in Node.js environment

export async function POST(req: Request) {
  // Allow only POST method
  if (req.method !== 'POST') {
    return NextResponse.json(
      { error: 'Method not allowed' },
      { status: 405 }
    );
  }

  try {
    const shopId = process.env.YOOKASSA_SHOP_ID;
    const secretKey = process.env.YOOKASSA_SECRET_KEY;

    // Log credentials for debugging (remove in production)
    console.log('ENV SHOP:', shopId ? '✅ present' : '❌ missing');
    console.log('ENV SECRET:', secretKey ? '✅ present' : '❌ missing');

    if (!shopId || !secretKey) {
      return NextResponse.json(
        { error: 'Missing YooKassa credentials' },
        { status: 500 }
      );
    }

    const checkout = new YooCheckout({ shopId, secretKey });

    const body = await req.json();
    const { amount, userId } = body;

    // Validate required fields
    if (!amount || !userId) {
      return NextResponse.json(
        { error: 'Missing amount or userId' },
        { status: 400 }
      );
    }

    // Validate amount is a positive number
    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    // Generate a proper idempotence key (UUID v4)
    const idempotenceKey = randomUUID();

    const payment = await checkout.createPayment(
      {
        amount: {
          value: numericAmount.toFixed(2),
          currency: 'RUB',
        },
        confirmation: {
          type: 'redirect',
          return_url: 'https://vitaklim.vercel.app/profile', // Consider making this configurable
        },
        capture: true,
        description: `Пополнение баланса пользователем ${userId}`,
        metadata: {
          userId,
        },
      },
      idempotenceKey
    );

    if (!payment.confirmation?.confirmation_url) {
      throw new Error('Payment confirmation URL is missing');
    }

    return NextResponse.json({
      confirmationUrl: payment.confirmation.confirmation_url,
    });
  } catch (error: any) {
    // Log full error details for debugging
    console.error('YooKassa FULL error:', error?.response?.data || error);

    // Return a user-friendly error message
    const errorMessage = error?.response?.data?.description || error?.message || 'Payment creation failed';
    return NextResponse.json(
      { error: errorMessage },
      { status: error?.response?.status || 500 }
    );
  }
}