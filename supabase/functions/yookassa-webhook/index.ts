import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // Вебхуки от ЮKassa приходят методом POST
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const payload = await req.json()
    console.log("ПОЛУЧЕНО УВЕДОМЛЕНИЕ:", payload.event)

    // Обрабатываем только успешную оплату
    if (payload.event === 'payment.succeeded') {
      const payment = payload.object
      const amount = parseFloat(payment.amount.value)
      const userId = payment.metadata?.userId // Достаем наш "приклеенный" ID из метаданных

      // Проверка наличия переменных окружения
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error("Системные ключи Supabase не найдены в Edge Function")
      }

      // Инициализируем клиента с Service Role Key, чтобы иметь права на запись в базу
      const supabase = createClient(supabaseUrl, supabaseServiceKey)

      if (userId) {
        // Вызываем SQL-функцию (RPC) для безопасного инкремента баланса
        const { error } = await supabase.rpc('increment_balance', { 
          user_id: userId, 
          amount_to_add: amount 
        })

        if (error) {
          console.error(`ОШИБКА RPC при пополнении для ${userId}:`, error)
          throw error
        }
        
        console.log(`УСПЕХ: Баланс пользователя ${userId} пополнен на ${amount} RUB`)
      } else {
        console.error("ОШИБКА: В метаданных платежа ЮKassa отсутствует userId. Начисление невозможно.")
      }
    }

    // Всегда возвращаем 200 OK ЮKassa, иначе она будет присылать уведомление повторно
    return new Response(JSON.stringify({ status: 'ok' }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    })

  } catch (err) {
    console.error("КРИТИЧЕСКАЯ ОШИБКА WEBHOOK:", err.message)
    // Возвращаем 400 только при явных ошибках парсинга, чтобы не "пугать" API ЮKassa
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' } 
    })
  }
})