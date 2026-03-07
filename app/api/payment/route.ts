import { NextResponse } from 'next/server';
import { YooCheckout } from '@a2seven/yoo-checkout';
import { randomUUID } from 'crypto';
import { createClient } from '@/app/lib/supabase-server';

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

    // Log credentials presence (remove in production)
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
    const { amount, telegramUserId } = body;

    const supabase = await createClient();
    let userId: string | null = null;

    // 1️⃣ Если пришёл Telegram пользователь
    if (telegramUserId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", `telegram_${telegramUserId}`)
        .maybeSingle();

      if (!profile) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }

      userId = profile.id;
    }

    // 2️⃣ Если обычный сайт
    else {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }

      userId = user.id;
    }

    if (!amount) {
      return NextResponse.json(
        { error: 'Missing amount' },
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

    // 🔒 Ограничение суммы пополнения
    if (numericAmount < 50 || numericAmount > 10000) {
      return NextResponse.json(
        { error: 'Сумма должна быть от 50 до 10000 ₽' },
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
          return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/profile`,
        },
        capture: true,
        description: `Пополнение баланса пользователем ${userId}`,
        metadata: {
          userId,
        },
        // Чек согласно 54-ФЗ с обязательными полями payment_subject и payment_mode
        receipt: {
          customer: {
            // Для Telegram пользователей email нужно передавать отдельно (например, из тела запроса)
            email: body.email || '',
          },
          items: [
            {
              description: 'Пополнение баланса',
              quantity: '1.00',
              amount: {
                value: numericAmount.toFixed(2),
                currency: 'RUB',
              },
              vat_code: 1, // без НДС
              payment_subject: 'service',      // признак предмета расчета — услуга
              payment_mode: 'full_payment',    // признак способа расчета — полный расчет
            },
          ],
          tax_system_code: 2, // ОСН (общая система налогообложения)
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
    const errorMessage =
      error?.response?.data?.description || error?.message || 'Payment creation failed';
    return NextResponse.json(
      { error: errorMessage },
      { status: error?.response?.status || 500 }
    );
  }
}