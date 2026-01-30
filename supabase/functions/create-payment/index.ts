import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Обработка CORS
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // 1. Извлекаем данные из запроса
    const { amount, userId } = await req.json()

    // 2. Инициализируем Supabase, чтобы достать email пользователя для чека
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await supabaseClient.auth.getUser()

    const shopId = Deno.env.get('YOOKASSA_SHOP_ID')
    const secretKey = Deno.env.get('YOOKASSA_SECRET_KEY')

    console.log(`Создание платежа: ${amount} RUB для пользователя ${userId}`)

    // 3. Запрос к API ЮKassa
    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(shopId + ':' + secretKey)}`,
        'Idempotence-Key': crypto.randomUUID(), // ЮKassa требует именно этот заголовок для защиты от дублей
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: { 
          value: amount.toFixed(2), 
          currency: 'RUB' 
        },
        confirmation: { 
          type: 'redirect', 
          return_url: 'https://alex-cosh.ru/' 
        },
        capture: true,
        description: "Пополнение баланса Vision",
        // МЕТАДАННЫЕ: Это самое главное для работы Вебхука
        metadata: {
          userId: userId 
        },
        // ЧЕК: Обязателен, если работаешь через облачную кассу
        receipt: {
          customer: { 
            email: user?.email || "customer@example.com" 
          },
          items: [
            {
              description: "Пополнение баланса (цифровой товар)",
              quantity: "1.00",
              amount: { value: amount.toFixed(2), currency: 'RUB' },
              vat_code: "1", // 1 — без НДС
              payment_mode: "full_payment",
              payment_subject: "service"
            }
          ]
        }
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('ЮKASSA ERROR:', JSON.stringify(data))
      return new Response(JSON.stringify({ error: data.description || "Ошибка ЮKassa" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Возвращаем фронтенду ссылку на оплату
    return new Response(JSON.stringify({ url: data.confirmation.confirmation_url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('CRITICAL ERROR:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})