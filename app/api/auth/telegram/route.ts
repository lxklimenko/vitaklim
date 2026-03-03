import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/app/lib/supabase-admin'

// Валидация данных от Mini App (initData)
function validateTelegramInitData(initData: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) throw new Error('BOT TOKEN not configured')

  const urlParams = new URLSearchParams(initData)
  const hash = urlParams.get('hash')
  if (!hash) return null

  urlParams.delete('hash')
  const dataCheckString = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const secretKey = crypto.createHash('sha256').update(botToken).digest()
  const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  if (hmac !== hash) return null

  const userString = urlParams.get('user')
  return userString ? JSON.parse(userString) : null
}

// Валидация данных от Виджета (widgetData)
function validateWidgetData(data: any) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) throw new Error('BOT TOKEN not configured')

  const { hash, ...user } = data
  if (!hash) return null

  // 1. Строка проверки: ключи в алфавитном порядке, только непустые значения
  const checkString = Object.keys(user)
    .sort()
    .map(key => `${key}=${user[key]}`)
    .join('\n')

  const secretKey = crypto.createHash('sha256').update(botToken).digest()
  const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex')

  if (hmac !== hash) return null

  // Проверка на устаревание (24 часа)
  if (user.auth_date) {
    const now = Math.floor(Date.now() / 1000)
    if (now - parseInt(user.auth_date) > 86400) return null
  }

  return user
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { initData, widgetData } = body;

    let telegramUser: any = null;
    if (initData) telegramUser = validateTelegramInitData(initData);
    else if (widgetData) telegramUser = validateWidgetData(widgetData);

    if (!telegramUser?.id) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 401 });
    }

    const email = `telegram_${telegramUser.id}@telegram.local`;
    const password = `secure_${telegramUser.id}`;

    // 1. Ищем, есть ли уже такой пользователь в Supabase Auth
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    const authUser = users?.find(u => u.email === email);

    let userId: string;

    if (!authUser) {
      // Создаем нового пользователя в Auth, если его нет
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError || !created.user) throw new Error('Auth creation failed');
      userId = created.user.id;
    } else {
      userId = authUser.id;
    }

    // 2. 🔥 МАГИЯ СКЛЕЙКИ: Ищем существующий профиль по telegram_id
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, balance')
      .eq('telegram_id', telegramUser.id)
      .maybeSingle();

    if (existingProfile) {
      // Если профиль от бота уже есть, обновляем его: 
      // привязываем ID от Auth и обновляем данные из Telegram
      await supabaseAdmin
        .from('profiles')
        .update({
          id: userId, // Связываем Auth ID с существующим профилем
          telegram_username: telegramUser.username || null,
          telegram_first_name: telegramUser.first_name || null,
          telegram_avatar_url: telegramUser.photo_url || null,
        })
        .eq('telegram_id', telegramUser.id);
        
      console.log("Profile linked for telegram_id:", telegramUser.id);
    } else {
      // Если профиля совсем нет (новый юзер), создаем с нуля
      await supabaseAdmin.from('profiles').insert({
        id: userId,
        telegram_id: telegramUser.id,
        balance: 1, // Приветственный бонус
        telegram_username: telegramUser.username || null,
        telegram_first_name: telegramUser.first_name || null,
        telegram_avatar_url: telegramUser.photo_url || null,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}