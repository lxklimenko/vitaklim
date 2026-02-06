// app/hooks/useAuth.ts
import { useState, useEffect } from 'react';
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

  // Загрузка баланса [cite: 100-101]
  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase.from('profiles').select('balance').eq('id', userId).single();
    if (!error && data) setBalance(data.balance);
  };

  // Загрузка избранного [cite: 99-100]
  const fetchFavorites = async (userId: string) => {
    const { data, error } = await supabase.from('favorites').select('prompt_id').eq('user_id', userId);
    if (!error && data) setFavorites(data.map((f: any) => f.prompt_id));
  };

  // Загрузка покупок [cite: 101]
  const fetchPurchases = async (userId: string) => {
    const { data, error } = await supabase.from('purchases').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (!error && data) setPurchases(data);
  };

  // Загрузка истории генераций [cite: 102]
  const fetchGenerations = async (userId: string) => {
    const { data, error } = await supabase.from('generations').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (!error && data) setGenerations(data);
  };

  // Параллельная загрузка всех данных пользователя
  const loadAllUserData = async (userId: string) => {
    // Promise.all запускает все функции одновременно
    try {
      await Promise.all([
        fetchProfile(userId),
        fetchFavorites(userId),
        fetchPurchases(userId),
        fetchGenerations(userId)
      ]);
    } catch (error) {
      console.error("Ошибка при параллельной загрузке данных:", error);
    }
  };

  useEffect(() => {
    // Проверка сессии при загрузке [cite: 114]
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadAllUserData(session.user.id);
      }
      setIsLoading(false);
    });

    // Подписка на изменения состояния 
    const { data: authData } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadAllUserData(session.user.id);
      } else {
        setBalance(0);
        setFavorites([]);
        setPurchases([]);
        setGenerations([]);
      }
    });

    return () => authData.subscription.unsubscribe();
  }, []);

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