// app/hooks/useAuth.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/app/lib/supabase';
import { User } from '@supabase/supabase-js';
import { Generation } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  
  const [balance, setBalance] = useState<number>(0);
  const [telegramUsername, setTelegramUsername] = useState<string | null>(null);
  const [telegramFirstName, setTelegramFirstName] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [generations, setGenerations] = useState<Generation[]>([]);
  
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [generationsLoading, setGenerationsLoading] = useState(false);
  
  const generationsLoaded = useRef(false);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('balance, telegram_username, telegram_first_name')
      .eq('id', userId)
      .single();
    if (!error && data) {
      setBalance(data.balance);
      setTelegramUsername(data.telegram_username);
      setTelegramFirstName(data.telegram_first_name);
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

  const fetchGenerations = async (userId: string, force = false) => {
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
      let telegramUser: any = null;

      if (typeof window !== 'undefined' && (window as any).Telegram) {
        const tg = (window as any).Telegram.WebApp;
        telegramUser = tg?.initDataUnsafe?.user;
      }

      if (telegramUser) {
        const fakeEmail = `telegram_${telegramUser.id}@tg.local`;
        const fakePassword = `tg_${telegramUser.id}`;

        const { data, error } = await supabase.auth.signInWithPassword({
          email: fakeEmail,
          password: fakePassword,
        });

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

          // 🔥 Проверяем существование профиля
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', session.user.id)
            .single();

          if (!existingProfile) {
            await supabase.from('profiles').insert({
              id: session.user.id,
              balance: 0,
              telegram_id: telegramUser.id,
              telegram_username: telegramUser.username || null,
              telegram_first_name: telegramUser.first_name || null,
            });
          } else {
            // Обновляем Telegram-данные, если профиль уже есть
            await supabase
              .from('profiles')
              .update({
                telegram_id: telegramUser.id,
                telegram_username: telegramUser.username || null,
                telegram_first_name: telegramUser.first_name || null,
              })
              .eq('id', session.user.id);
          }
        }

        setAuthReady(true);
        return;
      }

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
        setBalance(0);
        setTelegramUsername(null);
        setTelegramFirstName(null);
        setFavorites([]);
        setPurchases([]);
        setGenerations([]);
        generationsLoaded.current = false;
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
              // Аналогичную проверку можно добавить и здесь для надёжности
              const { error } = await supabase
                .from('profiles')
                .update({
                  telegram_id: telegramUser.id,
                  telegram_username: telegramUser.username || null,
                  telegram_first_name: telegramUser.first_name || null,
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
    favoritesLoading,
    generationsLoading,
    balance,
    telegramUsername,
    telegramFirstName,
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