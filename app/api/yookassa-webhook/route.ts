import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Bot } from '@maxhub/max-bot-api';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Используем MAX_BOT_TOKEN из Vercel
const MAX_TOKEN = process.env.MAX_BOT_TOKEN;
const maxBot = MAX_TOKEN ? new Bot(MAX_TOKEN) : null;

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
    const rawBody = await req.text();
    const isValid = await verifySignature(req, rawBody);
    
    if (!isValid) {
      console.error('Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    const notification = JSON.parse(rawBody);
    const payment = notification.object;

    if (payment.status === 'succeeded') {
      const userId = payment.metadata?.userId;
      const amount = payment.amount.value;

      if (!userId) {
        return NextResponse.json({ error: 'User ID missing' }, { status: 400 });
      }

      // Начисляем баланс в БД
      const { error: rpcError } = await supabase.rpc(
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

      // Уведомления пользователю
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('telegram_id, max_user_id')
          .eq('id', userId)
          .maybeSingle();

        const msg = `✅ Оплата прошла успешно!\n\nНа ваш баланс зачислено ${amount} 🍌`;

        // 1. В Telegram
        if (profile?.telegram_id) {
          await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: profile.telegram_id, text: msg }),
          });
        }

        // 2. В MAX (через надежный метод send)
        if (profile?.max_user_id && maxBot) {
          try {
            await (maxBot.api as any).send({
              recipient: { user_id: profile.max_user_id.toString() },
              message: { text: msg }
            });
            console.log('✅ Уведомление в MAX отправлено');
          } catch (maxErr) {
            console.error('❌ Ошибка отправки в MAX:', maxErr);
          }
        }
      } catch (notifyError) {
        console.error('⚠️ Ошибка в блоке уведомлений:', notifyError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}