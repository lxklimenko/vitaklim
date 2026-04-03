'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, ChevronRight, Loader2, User as UserIcon, History, Mail, FileText, Shield, Heart } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { supabase } from '@/app/lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Navigation } from '../components/Navigation';

interface ProfileData {
  telegram_username: string | null;
  telegram_first_name: string | null;
  telegram_avatar_url: string | null;
  balance: number;
}

export default function ProfileClient({ initialProfile }: { initialProfile: ProfileData | null }) {
  const { user, fetchProfile, authReady } = useAuth();
  const telegramUsername = initialProfile?.telegram_username ?? null;
  const telegramFirstName = initialProfile?.telegram_first_name ?? null;
  const telegramAvatarUrl = initialProfile?.telegram_avatar_url ?? null;
  const balance = initialProfile?.balance ?? 0;
  const isTelegramUser = !!telegramFirstName || !!telegramUsername;
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTopUpLoading, setIsTopUpLoading] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<string>("100");
  const [showTopUp, setShowTopUp] = useState(false);

  useEffect(() => {
    if (!authReady) return;
    const onAuth = async (tgUser: any) => {
      setIsSubmitting(true);
      try {
        const res = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ widgetData: tgUser }),
        });
        const data = await res.json();
        if (res.ok) {
          const email = `telegram_${tgUser.id}@telegram.local`;
          const password = `secure_${tgUser.id}`;
          const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
          if (signInError) throw signInError;
          toast.success('Успешный вход!');
          window.location.href = '/profile';
        } else {
          toast.error(data.error || 'Ошибка входа');
        }
      } catch (err: any) {
        toast.error('Ошибка соединения с сервером');
      } finally {
        setIsSubmitting(false);
      }
    };
    (window as any).onTelegramAuth = onAuth;
    const container = document.getElementById('telegram-login-container');
    if (container && !container.querySelector('iframe')) {
      container.innerHTML = '';
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.setAttribute('data-telegram-login', process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'klexprobot');
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-radius', '12');
      script.setAttribute('data-onauth', 'onTelegramAuth(user)');
      script.setAttribute('data-request-access', 'write');
      script.async = true;
      container.appendChild(script);
    }
  }, [authMode, authReady]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    if (!email.includes('@')) { toast.error('Введите корректный email'); setIsSubmitting(false); return; }
    if (password.length < 6) { toast.error('Пароль минимум 6 символов'); setIsSubmitting(false); return; }
    try {
      if (authMode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('С возвращением!');
        if (data.user) fetchProfile(data.user.id);
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
    const numericAmount = parseInt(topUpAmount);
    if (!user) { toast.error('Нужно войти в аккаунт'); return; }
    if (!numericAmount || numericAmount < 50) { toast.error('Минимальная сумма — 50 ₽'); return; }
    try {
      setIsTopUpLoading(true);
      const res = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: numericAmount, userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Ошибка оплаты'); return; }
      if (data.confirmationUrl) {
        const tg = (window as any).Telegram?.WebApp;
        if (tg) tg.openLink(data.confirmationUrl);
        else window.location.href = data.confirmationUrl;
        return;
      }
      toast.error('Не удалось получить ссылку на оплату');
    } catch { toast.error('Ошибка соединения'); }
    finally { setIsTopUpLoading(false); }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-white/30" size={28} />
      </div>
    );
  }

  // ===== ФОРМА ВХОДА =====
  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <Toaster position="top-center" theme="dark" />

        <div className="flex-1 flex flex-col justify-center px-6 py-12 max-w-sm mx-auto w-full">
          {/* Лого */}
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <UserIcon size={28} className="text-white/40" />
            </div>
            <h1 className="text-[26px] font-bold tracking-tight mb-2">
              {authMode === 'login' ? 'Войти' : 'Регистрация'}
            </h1>
            <p className="text-[13px] text-white/35 leading-relaxed">
              Сохраняй генерации и управляй балансом
            </p>
          </div>

          {/* Форма */}
          <form onSubmit={handleAuth} className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/6 border border-white/8 rounded-2xl px-4 py-3.5 text-white text-[15px] focus:outline-none focus:border-white/20 transition placeholder:text-white/25"
            />
            <input
              type="password"
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/6 border border-white/8 rounded-2xl px-4 py-3.5 text-white text-[15px] focus:outline-none focus:border-white/20 transition placeholder:text-white/25"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-white text-black font-semibold rounded-2xl py-3.5 text-[15px] hover:bg-white/90 transition disabled:opacity-50 flex justify-center items-center gap-2 mt-2"
            >
              {isSubmitting && <Loader2 className="animate-spin" size={16} />}
              {authMode === 'login' ? 'Войти' : 'Создать аккаунт'}
            </button>
          </form>

          {/* Telegram */}
          {authMode === 'login' && (
            <div className="flex flex-col items-center gap-3 mt-6">
              <p className="text-[11px] text-white/25 uppercase tracking-widest">или войти через</p>
              <div id="telegram-login-container" className="min-h-10 flex items-center justify-center" />
            </div>
          )}

          {/* Переключатель */}
          <button
            onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
            className="text-white/40 hover:text-white text-[13px] text-center mt-6 transition"
          >
            {authMode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
          </button>
        </div>

        <Navigation />
      </div>
    );
  }

  // ===== ПРОФИЛЬ =====
  const displayName = telegramFirstName || (telegramUsername ? `@${telegramUsername}` : user.email?.split('@')[0]);

  return (
    <div className="min-h-screen bg-black text-white pb-28">
      <Toaster position="top-center" theme="dark" />

      {/* Шапка профиля */}
      <div className="px-6 pt-12 pb-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-[28px] font-bold tracking-tight">Профиль</h1>
          <button onClick={handleLogout} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/10 transition">
            <LogOut size={16} />
          </button>
        </div>

        {/* Аватар + имя */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-white/10 flex items-center justify-center text-[22px] font-bold shrink-0">
            {telegramAvatarUrl ? (
              <img src={telegramAvatarUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <span>{displayName?.[0]?.toUpperCase()}</span>
            )}
          </div>
          <div>
            <p className="text-[18px] font-semibold">{displayName}</p>
            {!isTelegramUser && (
              <p className="text-[13px] text-white/35 mt-0.5">{user.email}</p>
            )}
          </div>
        </div>
      </div>

      {/* Баланс */}
      <div className="px-6 mb-6">
        <div
          className="bg-white/4 border border-white/[0.07] rounded-3xl p-5 cursor-pointer"
          onClick={() => setShowTopUp(!showTopUp)}
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-white/30">Баланс</p>
            <ChevronRight size={16} className={`text-white/20 transition-transform ${showTopUp ? 'rotate-90' : ''}`} />
          </div>
          <p className="text-[32px] font-bold tracking-tight">{balance} <span className="text-[24px]">🍌</span></p>
        </div>

        {/* Пополнение — разворачивается */}
        {showTopUp && (
          <div className="bg-white/3 border border-white/6 rounded-3xl p-5 mt-2 space-y-4">
            <p className="text-[12px] text-white/30 uppercase tracking-widest">Пополнение (₽)</p>
            <div className="flex gap-2">
              {[100, 500, 1000].map((val) => (
                <button
                  key={val}
                  onClick={() => setTopUpAmount(val.toString())}
                  className={`flex-1 py-2 rounded-xl text-[13px] font-medium border transition ${
                    topUpAmount === val.toString()
                      ? 'bg-white text-black border-white'
                      : 'border-white/10 text-white/50 hover:border-white/20'
                  }`}
                >
                  {val} ₽
                </button>
              ))}
            </div>
            <input
              type="number"
              placeholder="Другая сумма"
              value={topUpAmount}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "" || /^\d+$/.test(val)) setTopUpAmount(val);
              }}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-[14px] focus:outline-none focus:border-white/20 placeholder:text-white/20"
            />
            <button
              onClick={handleTopUp}
              disabled={isTopUpLoading}
              className="w-full bg-white text-black font-semibold rounded-2xl py-3.5 text-[15px] hover:bg-white/90 transition disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {isTopUpLoading ? <Loader2 className="animate-spin" size={16} /> : 'Пополнить'}
            </button>
          </div>
        )}
      </div>

      {/* Меню */}
      <div className="px-6 space-y-2">
        <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-white/25 mb-3 px-1">Аккаунт</p>

        <Link href="/history" className="flex items-center justify-between p-4 bg-white/4 border border-white/6 rounded-2xl hover:bg-white/[0.07] transition">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center">
              <History size={15} className="text-white/50" />
            </div>
            <span className="text-[15px]">История генераций</span>
          </div>
          <ChevronRight size={16} className="text-white/20" />
        </Link>
        <Link href="/favorites" className="flex items-center justify-between p-4 bg-white/4 border border-white/6 rounded-2xl hover:bg-white/[0.07] transition">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center">
              <Heart size={15} className="text-white/50" />
            </div>
            <span className="text-[15px]">Избранное</span>
          </div>
          <ChevronRight size={16} className="text-white/20" />
        </Link>

        <a href="mailto:support@klex.pro" className="flex items-center justify-between p-4 bg-white/4 border border-white/6 rounded-2xl hover:bg-white/[0.07] transition">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center">
              <Mail size={15} className="text-white/50" />
            </div>
            <span className="text-[15px]">Поддержка</span>
          </div>
          <ChevronRight size={16} className="text-white/20" />
        </a>
      </div>

      {/* Юридические ссылки */}
      <div className="px-6 mt-8 space-y-2">
        <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-white/25 mb-3 px-1">Документы</p>

        <Link href="/terms" className="flex items-center justify-between p-4 bg-white/4 border border-white/6 rounded-2xl hover:bg-white/[0.07] transition">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center">
              <FileText size={15} className="text-white/50" />
            </div>
            <span className="text-[15px]">Публичная оферта</span>
          </div>
          <ChevronRight size={16} className="text-white/20" />
        </Link>

        <Link href="/privacy" className="flex items-center justify-between p-4 bg-white/4 border border-white/6 rounded-2xl hover:bg-white/[0.07] transition">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center">
              <Shield size={15} className="text-white/50" />
            </div>
            <span className="text-[15px]">Политика конфиденциальности</span>
          </div>
          <ChevronRight size={16} className="text-white/20" />
        </Link>
      </div>

      {/* Версия */}
      <p className="text-center text-white/15 text-[11px] mt-10 pb-4">KLEX.PRO · Версия 1.0.2</p>

      <Navigation />
    </div>
  );
}