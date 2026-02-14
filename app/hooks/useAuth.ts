// app/hooks/useAuth.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/app/lib/supabase';
import { User } from '@supabase/supabase-js';
import { Generation } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  
  const [balance, setBalance] = useState<number>(0);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [generations, setGenerations] = useState<Generation[]>([]);
  
  // Отдельные флаги загрузки вместо глобального isLoading
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [generationsLoading, setGenerationsLoading] = useState(false);
  
  // Флаг для отслеживания загрузки истории генераций
  const generationsLoaded = useRef(false);

  // Загрузка баланса
  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase.from('profiles').select('balance').eq('id', userId).single();
    if (!error && data) setBalance(data.balance);
  };

  // Загрузка избранного с флагом загрузки
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

  // Загрузка покупок
  const fetchPurchases = async (userId: string) => {
    const { data, error } = await supabase.from('purchases').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (!error && data) setPurchases(data);
  };

  // Загрузка истории генераций (с флагом принудительной загрузки)
  const fetchGenerations = async (userId: string, force = false) => {
    // Если уже загружено и это не принудительное обновление — выходим
    if (generationsLoaded.current && !force) return;
    
    setGenerationsLoading(true);

    const { data } = await supabase
      .from('generations')
      .select('id, user_id, prompt, image_url, created_at, is_favorite')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) {
      setGenerations(data as Generation[]);
      generationsLoaded.current = true;
    }

    setGenerationsLoading(false);
  };

  // Параллельная загрузка данных пользователя (без загрузки истории)
  const loadAllUserData = useCallback(async (userId: string) => {
    try {
      await Promise.all([
        fetchProfile(userId),
        fetchFavorites(userId)
      ]);
    } catch (error) {
      console.error("Ошибка при параллельной загрузке данных пользователя:", error);
    }
  }, []);

  useEffect(() => {
    const initSession = async () => {
      // 1️⃣ Проверяем есть ли Telegram
      let telegramUser: any = null;

      if (typeof window !== 'undefined' && (window as any).Telegram) {
        const tg = (window as any).Telegram.WebApp;
        telegramUser = tg?.initDataUnsafe?.user;
      }

      // 2️⃣ Если есть Telegram пользователь — делаем авто-логин
      if (telegramUser) {
        const fakeEmail = `telegram_${telegramUser.id}@tg.local`;
        const fakePassword = `tg_${telegramUser.id}`;

        // Пытаемся войти
        const { data, error } = await supabase.auth.signInWithPassword({
          email: fakeEmail,
          password: fakePassword,
        });

        // Если пользователя нет — создаём
        if (error) {
          const { data: signUpData } = await supabase.auth.signUp({
            email: fakeEmail,
            password: fakePassword,
          });

          if (signUpData.user) {
            await supabase.auth.signInWithPassword({
              email: fakeEmail,
              password: fakePassword,
            });
          }
        }

        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          setUser(session.user);
          loadAllUserData(session.user.id);

          // Обновляем данные профиля из Telegram
          await supabase
            .from('profiles')
            .update({
              telegram_id: telegramUser.id,
              telegram_username: telegramUser.username || null,
              telegram_first_name: telegramUser.first_name || null,
            })
            .eq('id', session.user.id);
        }

        setAuthReady(true);
        return;
      }

      // 3️⃣ Обычная логика (Email login)
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);
        loadAllUserData(session.user.id);
      }

      setAuthReady(true);
    };

    initSession();

    const { data: authData } = supabase.auth.onAuthStateChange((_event, session) => {
      // ❗ Реальный logout
      if (_event === 'SIGNED_OUT') {
        setUser(null);
        setBalance(0);
        setFavorites([]);
        setPurchases([]);
        setGenerations([]);
        generationsLoaded.current = false;
        return;
      }

      // ❗ Реальный login
      if (_event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        loadAllUserData(session.user.id);
      }
    });

    return () => authData.subscription.unsubscribe();
  }, [loadAllUserData]);

  return { 
    user,
    authReady,
    favoritesLoading,
    generationsLoading,
    balance,
    favorites,
    purchases,
    generations,
    setFavorites,
    setGenerations,
    setPurchases,
    fetchProfile,
    fetchGenerations
  };
}