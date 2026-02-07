// app/hooks/useAuth.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { Generation } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Флаг для отслеживания загрузки истории генераций
  const generationsLoaded = useRef(false);

  // Загрузка баланса
  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase.from('profiles').select('balance').eq('id', userId).single();
    if (!error && data) setBalance(data.balance);
  };

  // Загрузка избранного
  const fetchFavorites = async (userId: string) => {
    const { data, error } = await supabase.from('favorites').select('prompt_id').eq('user_id', userId);
    if (!error && data) setFavorites(data.map((f: any) => f.prompt_id));
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
    
    const { data, error } = await supabase
      .from('generations')
      .select('id, user_id, prompt, image_url, created_at, is_favorite') // Добавили user_id
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      setGenerations(data as Generation[]);
      generationsLoaded.current = true; // Помечаем как загруженное
    }
  };

  // Параллельная загрузка данных пользователя (без загрузки истории)
  const loadAllUserData = useCallback(async (userId: string) => {
    try {
      // Запускаем запросы для профиля, избранного и покупок
      await Promise.all([
        fetchProfile(userId),
        fetchFavorites(userId),
        fetchPurchases(userId)
      ]);
    } catch (error) {
      console.error("Ошибка при параллельной загрузке данных пользователя:", error);
    }
  }, []);

  useEffect(() => {
    // Асинхронная функция инициализации сессии
    const initSession = async () => {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        setUser(session.user);
        // Загружаем только основные данные пользователя
        await loadAllUserData(session.user.id);
      }
      setIsLoading(false);
    };

    initSession();

    // Подписка на изменения состояния аутентификации
    const { data: authData } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        // Включаем лоадер при смене пользователя
        setIsLoading(true);
        await loadAllUserData(currentUser.id);
        setIsLoading(false);
      } else {
        // Сбрасываем данные при выходе
        setBalance(0);
        setFavorites([]);
        setPurchases([]);
        setGenerations([]);
        generationsLoaded.current = false; // Сбрасываем флаг загрузки истории
      }
    });

    return () => authData.subscription.unsubscribe();
  }, [loadAllUserData]);

  // Сбрасываем флаг при выходе пользователя
  useEffect(() => {
    if (!user) {
      generationsLoaded.current = false;
    }
  }, [user]);

  return { 
    user, 
    balance, 
    favorites, 
    purchases, 
    generations, 
    setFavorites, 
    setGenerations,
    setPurchases,
    fetchProfile, 
    fetchGenerations,
    isLoading 
  };
}