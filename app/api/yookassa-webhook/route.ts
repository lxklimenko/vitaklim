export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { YooCheckout } from '@a2seven/yoo-checkout';
import { Bot } from '@maxhub/max-bot-api';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Инициализируем ЮKassa для проверки статуса
const checkout = new YooCheckout({
  shopId: process.env.YOOKASSA_SHOP_ID!,
  secretKey: process.env.YOOKASSA_SECRET_KEY!,
});

// Инициализируем Max бота, если токен задан
const MAX_TOKEN = process.env.MAX_BOT_TOKEN;
const maxBot = MAX_TOKEN ? new Bot(MAX_TOKEN) : null;

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
          p_yookassa_id: paymentId,
        }
      );

      if (rpcError) {
        console.error('❌ RPC error:', rpcError);
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
      }

      console.log('✅ Balance updated for user:', userId);

      // --- Отправка уведомления в зависимости от платформы ---
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('telegram_id, max_user_id')
          .eq('id', userId)
          .maybeSingle();

        const fromPlatform = payment.metadata?.from; // 'max' или 'tg'
        const msg = `✅ Оплата прошла успешно!\n\nНа ваш баланс зачислено ${amount} 🍌`;

        // 1. Если платеж из MAX — шлем в MAX
        if (fromPlatform === 'max' && profile?.max_user_id && maxBot) {
          try {
            // В документации: await bot.api.sendMessageToUser(id, text, { options });
            await maxBot.api.sendMessageToUser(
              Number(profile.max_user_id), // ID пользователя как число
              msg,
              { format: 'markdown' } // Чтобы красиво отобразить жирный текст и эмодзи
            );
            console.log('✅ Уведомление в MAX успешно отправлено через sendMessageToUser');
          } catch (maxErr: any) {
            console.error('❌ Ошибка API MAX:', maxErr.message);
            
            // Если по ID пользователя не прошло, пробуем как в чат (иногда ID совпадают)
            try {
              await maxBot.api.sendMessageToChat(
                Number(profile.max_user_id),
                msg,
                { format: 'markdown' }
              );
              console.log('✅ Уведомление в MAX отправлено через sendMessageToChat (резерв)');
            } catch (fallbackErr: any) {
              console.error('❌ Все методы из документации не сработали:', fallbackErr.message);
            }
          }
        }
        // 2. Иначе (или если это был TG) — шлем в Telegram
        else if (profile?.telegram_id) {
          await fetch(
            `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: profile.telegram_id, text: msg }),
            }
          );
          console.log('✅ Уведомление отправлено в Telegram');
        } else {
          console.log(`ℹ️ Нет данных для отправки уведомления пользователю ${userId}`);
        }
      } catch (notifyError) {
        console.error('⚠️ Ошибка уведомлений:', notifyError);
      }
      // --- Конец блока уведомления ---

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('🚨 Webhook fatal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}