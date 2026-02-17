'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, LogOut, CreditCard, Mail, User as UserIcon, Loader2 } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { supabase } from '@/app/lib/supabase';

// Импорты
import { useAuth } from '../hooks/useAuth';
import { Navigation } from '../components/Navigation';

export default function ProfilePage() {
  // Получаем данные из хука
  const {
    user,
    balance,
    fetchProfile,
    authReady,
    telegramUsername,
    telegramFirstName,
    telegramAvatarUrl,          // 👈 добавлено
  } = useAuth();
  
  // Определяем, вошел ли пользователь через Telegram
  const isTelegramUser = !!telegramFirstName || !!telegramUsername;

  const router = useRouter();

  // Состояния для формы входа
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTopUpLoading, setIsTopUpLoading] = useState(false);

  // Логика входа / регистрации
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!email.includes('@')) {
      toast.error('Введите корректный email');
      setIsSubmitting(false);
      return;
    }
    if (password.length < 6) {
      toast.error('Пароль должен быть не менее 6 символов');
      setIsSubmitting(false);
      return;
    }

    try {
      if (authMode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('С возвращением!');

        // Передаём ID пользователя после успешного входа
        if (data.user) {
          fetchProfile(data.user.id);
        }
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success('Аккаунт создан! Проверьте почту.');
        setAuthMode('login');
      }
    } catch (error: any) {
      toast.error(error.message || 'Ошибка авторизации');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const handleTopUp = async () => {
    if (!user) {
      toast.error('Нужно войти в аккаунт');
      return;
    }
  
    try {
      setIsTopUpLoading(true);
  
      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: 10,
          userId: user.id,
        }),
      });
  
      const data = await res.json();
  
      if (!res.ok) {
        toast.error(data.error || 'Ошибка оплаты');
        return;
      }
  
      console.log('Ответ сервера:', data);
  
      // Редирект на страницу оплаты, если получена ссылка
      if (data.confirmationUrl) {
        // Используем Telegram WebApp, если доступен, иначе обычный переход
        if (typeof window !== 'undefined') {
          const tg = (window as any).Telegram?.WebApp;
          if (tg) {
            tg.openLink(data.confirmationUrl);
          } else {
            window.location.href = data.confirmationUrl;
          }
        }
        return;
      }
  
      toast.error('Не удалось получить ссылку на оплату');
    } catch (error) {
      console.error(error);
      toast.error('Ошибка соединения');
    } finally {
      setIsTopUpLoading(false);
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-28 font-sans">
      <Toaster position="top-center" theme="dark" />

      {/* Хедер */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition">
            <ChevronLeft size={24} />
          </Link>
          <h1 className="text-xl font-bold">Профиль</h1>
        </div>

        {user && (
          <button onClick={handleLogout} className="text-red-400 hover:text-red-300">
            <LogOut size={20} />
          </button>
        )}
      </header>

      <div className="px-4 py-8 max-w-md mx-auto">
        {!user ? (
          /* Форма входа */
          <div className="flex flex-col gap-6">
            <div className="text-center mb-4">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                <UserIcon size={40} className="text-white/50" />
              </div>
              <h2 className="text-2xl font-bold mb-2">
                {authMode === 'login' ? 'Вход в аккаунт' : 'Регистрация'}
              </h2>
              <p className="text-white/40 text-sm">
                Войдите, чтобы сохранять генерации и управлять подпиской
              </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition"
                />
              </div>
              <div>
                <input
                  type="password"
                  placeholder="Пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/30 transition"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-white text-black font-bold rounded-xl py-3 hover:bg-gray-200 transition disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isSubmitting && <Loader2 className="animate-spin" size={18} />}
                {authMode === 'login' ? 'Войти' : 'Создать аккаунт'}
              </button>

              {/* Кнопка входа через Telegram (всегда показывается в режиме входа) */}
              {authMode === 'login' && (
                <a
                  href="https://t.me/Vitaklimbot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full mt-3 bg-blue-500 text-white font-bold rounded-xl py-3 hover:bg-blue-600 transition text-center block"
                >
                  Войти через Telegram
                </a>
              )}
            </form>

            <div className="text-center mt-4">
              <button
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                className="text-white/60 hover:text-white text-sm"
              >
                {authMode === 'login'
                  ? 'Нет аккаунта? Зарегистрироваться'
                  : 'Уже есть аккаунт? Войти'}
              </button>
            </div>
          </div>
        ) : (
          /* Профиль пользователя */
          <div className="flex flex-col gap-6">
            <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-4 mb-6">
                {/* Аватар — заменён по инструкции */}
                <div className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl font-bold">
                  {telegramAvatarUrl ? (
                    <img
                      src={telegramAvatarUrl}
                      alt="avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    user.email?.[0].toUpperCase()
                  )}
                </div>
                <div className="overflow-hidden">
                  <p className="text-white/40 text-xs uppercase tracking-wider font-medium mb-1">
                    Аккаунт
                  </p>
                  <p className="font-medium truncate">
                    {telegramFirstName
                      ? telegramFirstName
                      : telegramUsername
                        ? `@${telegramUsername}`
                        : user.email}
                  </p>
                  {!isTelegramUser && (
                    <p className="text-white/40 text-xs mt-1 truncate">
                      {user.email}
                    </p>
                  )}
                </div>
              </div>

              <div className="bg-black/20 rounded-xl p-4 flex items-center justify-between mb-4">
                <div>
                  <p className="text-white/40 text-xs mb-1">Баланс кредитов</p>
                  <p className="text-2xl font-bold font-mono">{balance}</p>
                </div>
                <CreditCard className="text-white/20" />
              </div>

              <button
                onClick={handleTopUp}
                disabled={isTopUpLoading}
                className="w-full bg-white text-black font-bold rounded-xl py-3 hover:bg-gray-200 transition flex justify-center items-center gap-2"
              >
                {isTopUpLoading ? <Loader2 className="animate-spin" size={18} /> : 'Пополнить баланс'}
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold mb-4">Настройки</h3>

              <Link
                href="/history"
                className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition"
              >
                <span>История генераций</span>
                <ChevronLeft className="rotate-180 text-white/40" size={20} />
              </Link>

              <a
                href="mailto:support@example.com"
                className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition"
              >
                <div className="flex items-center gap-3">
                  <Mail size={18} className="text-white/60" />
                  <span>Поддержка</span>
                </div>
              </a>
            </div>

            <div className="pt-4">
              <p className="text-center text-white/20 text-xs">ID: {user.id}</p>
              <p className="text-center text-white/20 text-xs mt-1">Версия 1.0.2</p>
            </div>
          </div>
        )}
      </div>

      <Navigation onOpenGenerator={() => router.push('/')} />
    </div>
  );
}