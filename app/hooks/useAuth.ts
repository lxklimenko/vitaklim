// app/hooks/useAuth.ts
import { useState, useEffect, useCallback } from 'react';
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

  // Загрузка истории генераций
  const fetchGenerations = async (userId: string) => {
    const { data, error } = await supabase.from('generations').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (!error && data) setGenerations(data);
  };

  // Параллельная загрузка всех данных пользователя
  const loadAllUserData = useCallback(async (userId: string) => {
    try {
      // Запускаем все запросы одновременно
      await Promise.all([
        fetchProfile(userId),
        fetchFavorites(userId),
        fetchPurchases(userId),
        fetchGenerations(userId)
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
        // Ждем завершения всех запросов перед тем, как выключить лоадер
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
      }
    });

    return () => authData.subscription.unsubscribe();
  }, [loadAllUserData]);

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