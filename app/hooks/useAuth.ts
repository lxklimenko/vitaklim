// app/hooks/useAuth.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/app/lib/supabase';
import { User } from '@supabase/supabase-js';
import { Generation } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);
  const [telegramFirstName, setTelegramFirstName] = useState<string | null>(null);
  const [telegramAvatarUrl, setTelegramAvatarUrl] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [generations, setGenerations] = useState<Generation[]>([]);
  
  // Добавлено состояние для баланса
  const [balance, setBalance] = useState<number>(0);
  
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [generationsLoading, setGenerationsLoading] = useState(false);
  
  const [profileReady, setProfileReady] = useState(false);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('telegram_username, telegram_first_name, telegram_avatar_url, balance')
      .eq('id', userId)
      .single();
    if (!error && data) {
      setTelegramUsername(data.telegram_username);
      setTelegramFirstName(data.telegram_first_name);
      setTelegramAvatarUrl(data.telegram_avatar_url);
      // Устанавливаем баланс из полученных данных
      setBalance(data.balance ?? 0);
      setProfileReady(true);
    }
  };

  const fetchFavorites = async (userId: string) => {
    setFavoritesLoading(true);
    const { data } = await supabase
      .from('favorites')
      .select('prompt_id')
      .eq('user_id', userId);

    if (data) {
      setFavorites(data.map((f: any) => f.prompt_id));
    }
    setFavoritesLoading(false);
  };

  const fetchPurchases = async (userId: string) => {
    const { data, error } = await supabase
      .from('purchases')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (!error && data) setPurchases(data);
  };

  // 🔧 Заменяем функцию loadAllUserData
  const loadAllUserData = useCallback(
    async (userId: string, skipProfile = false) => {
      try {
        if (skipProfile) {
          await fetchFavorites(userId)
        } else {
          await Promise.all([
            fetchProfile(userId),
            fetchFavorites(userId)
          ])
        }
      } catch (error) {
        console.error("Ошибка при загрузке данных пользователя:", error);
      }
    },
    []
  )

  useEffect(() => {
    const initSession = async () => {
      // Telegram авторизация через initData
      if (typeof window !== 'undefined' && (window as any).Telegram) {
        const tg = (window as any).Telegram.WebApp;

        if (tg?.initData) {
          // 1️⃣ Передаём initData на сервер для валидации и сохранения
          await fetch('/api/auth/telegram', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              initData: tg.initData
            })
          });

          // Получаем user из initDataUnsafe (только для email генерации)
          const telegramUser = tg.initDataUnsafe?.user;

          if (telegramUser?.id) {
            const email = `telegram_${telegramUser.id}@telegram.local`;
            const password = `secure_${telegramUser.id}`;

            const { data, error } = await supabase.auth.signInWithPassword({
              email,
              password,
            });

            if (data?.user) {
              setUser(data.user);
              loadAllUserData(data.user.id);
            }
          }

          setAuthReady(true);
          return;
        }
      }

      // Обычная сессия (email/password или cookie)
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);
        loadAllUserData(session.user.id);
      }

      setAuthReady(true);
    };

    initSession();

    const { data: authData } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'SIGNED_OUT') {
        setUser(null);
        setTelegramUsername(null);
        setTelegramFirstName(null);
        setTelegramAvatarUrl(null);
        setFavorites([]);
        setPurchases([]);
        setGenerations([]);
        setBalance(0); // Сбрасываем баланс при выходе
        setProfileReady(false);
        return;
      }

      if (_event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        loadAllUserData(session.user.id);

        if (typeof window !== 'undefined' && (window as any).Telegram) {
          const tg = (window as any).Telegram.WebApp;
          const telegramUser = tg?.initDataUnsafe?.user;

          if (telegramUser) {
            (async () => {
              const { error } = await supabase
                .from('profiles')
                .update({
                  telegram_id: telegramUser.id,
                  telegram_username: telegramUser.username || null,
                  telegram_first_name: telegramUser.first_name || null,
                  // telegram_avatar_url не обновляем здесь, так как его нет в initDataUnsafe
                })
                .eq('id', session.user.id);
              
              if (error) {
                console.error('Ошибка обновления Telegram данных:', error);
              }
            })();
          }
        }
      }
    });

    return () => authData.subscription.unsubscribe();
  }, [loadAllUserData]);

  return { 
    user,
    authReady,
    profileReady,
    favoritesLoading,
    generationsLoading,
    telegramUsername,
    telegramFirstName,
    telegramAvatarUrl,
    favorites,
    purchases,
    generations,
    balance,          // Добавлено
    setBalance,       // Добавлено (если требуется снаружи)
    setFavorites,
    setGenerations,
    setPurchases,
    fetchProfile,
  };
}