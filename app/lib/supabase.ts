// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Отсутствуют переменные окружения для Supabase. Проверь .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,      // Сохраняет сессию в localStorage
    autoRefreshToken: true,    // Автоматически обновляет токен доступа
    detectSessionInUrl: true,  // Нужно для входа по ссылке из почты/OAuth
  },
});