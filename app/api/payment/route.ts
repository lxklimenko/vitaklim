import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Bot } from '@maxhub/max-bot-api';

// Инициализация Supabase с сервисным ключом (для доступа к профилям)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Инициализация бота MAX
const MAX_TOKEN = process.env.BOT_TOKEN;
const maxBot = MAX_TOKEN ? new Bot(MAX_TOKEN) : null;

// Функция для проверки подписи вебхука ЮKassa
async function verifySignature(req: Request, body: string): Promise<boolean> {
  const signature = req.headers.get('x-yookassa-signature');
  if (!signature) return false;

  const secret = process.env.YOOKASSA_WEBHOOK_SECRET;
  if (!secret) return false;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(body);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signatureBuffer = Uint8Array.from(
    signature.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );

  return await crypto.subtle.verify('HMAC', cryptoKey, signatureBuffer, messageData);
}

export async function POST(req: Request) {
  try {
    // 1. Получаем сырое тело запроса для проверки подписи
    const rawBody = await req.text();
    const isValid = await verifySignature(req, rawBody);
    if (!isValid) {
      console.error('Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // 2. Парсим тело запроса
    const notification = JSON.parse(rawBody);
    const payment = notification.object;

    // 3. Обрабатываем только успешные платежи
    if (payment.status === 'succeeded') {
      const userId = payment.metadata?.userId;
      const amount = payment.amount.value;

      if (!userId) {
        console.error('User ID not found in payment metadata');
        return NextResponse.json({ error: 'User ID missing' }, { status: 400 });
      }

      // =========================================================
      // БЛОК НАЧИСЛЕНИЯ БАЛАНСА (RPC)
      // =========================================================
      const { data: balanceResult, error: rpcError } = await supabase.rpc(
        'process_successful_payment',
        {
          p_user_id: userId,
          p_amount: parseFloat(amount),
          p_yookassa_id: payment.id
        }
      );

      if (rpcError) {
        console.error('RPC error:', rpcError);
        return NextResponse.json({ error: 'Failed to update balance' }, { status: 500 });
      }

      console.log('✅ Balance updated for user:', userId);

      // =========================================================
      // НОВЫЙ БЛОК ОТПРАВКИ УВЕДОМЛЕНИЙ (Telegram + MAX) С ПОДРОБНЫМИ ЛОГАМИ
      // =========================================================
      try {
        // Получаем профиль пользователя для отправки уведомлений
        const { data: profile, error: dbError } = await supabase
          .from('profiles')
          .select('telegram_id, max_user_id')
          .eq('id', userId)
          .maybeSingle();

        if (dbError) {
          console.error('❌ Ошибка поиска профиля в вебхуке:', dbError);
        }

        console.log(`🔎 Проверка ID для уведомления:`);
        console.log(`   - User ID: ${userId}`);
        console.log(`   - Telegram ID: ${profile?.telegram_id ?? 'не указан'}`);
        console.log(`   - MAX User ID: ${profile?.max_user_id ?? 'не указан'}`);

        const msg = `✅ Оплата прошла успешно!\n\nНа ваш баланс зачислено ${amount} 🍌`;

        // 1. Отправка в Telegram
        if (profile?.telegram_id) {
          try {
            const tgResponse = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chat_id: profile.telegram_id, text: msg }),
            });
            if (tgResponse.ok) {
              console.log('✅ Уведомление в Telegram отправлено');
            } else {
              const tgError = await tgResponse.text();
              console.error(`❌ Ошибка отправки в Telegram: ${tgResponse.status} - ${tgError}`);
            }
          } catch (tgErr) {
            console.error('❌ Исключение при отправке в Telegram:', tgErr);
          }
        } else {
          console.log('ℹ️ Нет Telegram ID для уведомления');
        }

        // 2. Отправка в MAX
        if (profile?.max_user_id) {
          if (maxBot) {
            try {
              await (maxBot.api as any).sendMessageToChat({
                chat_id: profile.max_user_id,
                text: msg
              });
              console.log('✅ Уведомление в MAX отправлено');
            } catch (maxErr) {
              console.error('❌ Ошибка при отправке в MAX:', maxErr);
            }
          } else {
            console.error('❌ Ошибка: maxBot не инициализирован. Проверь BOT_TOKEN в Vercel!');
          }
        } else {
          console.log('ℹ️ Нет MAX User ID для уведомления');
        }

      } catch (notifyError) {
        console.error('⚠️ Критическая ошибка в блоке уведомлений:', notifyError);
      }
      // =========================================================

      // Всегда возвращаем 200 OK, чтобы ЮKassa не слал повторные уведомления
      return NextResponse.json({ success: true });
    }

    // Если статус платежа не succeeded, просто возвращаем успех
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}