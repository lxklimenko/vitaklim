'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Heart } from 'lucide-react';
import { Toaster } from 'sonner';

// Импорты
import { Navigation } from '../components/Navigation';
import { PromptCard } from '../components/PromptCard';
import { useAuth } from '../hooks/useAuth';
import { useAppActions } from '../hooks/useAppActions';
import prompts from '../data/prompts.json';

// Импорт модалок
import dynamic from 'next/dynamic';
const ProfileModal = dynamic(() => import('../components/ProfileModal').then(m => m.ProfileModal), { ssr: false });

export default function FavoritesPage() {
  const { user, favorites, setFavorites, fetchProfile, purchases } = useAuth();
  
  // Состояния для модалок
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  // Действия
  const actions = useAppActions(user, setFavorites, fetchProfile, setIsProfileOpen);

  // Фильтруем промпты, оставляя только избранные
  const favoritePrompts = prompts.filter((prompt) =>
    favorites.includes(prompt.id)
  );

  // Обертка для копирования
  const [copiedId, setCopiedId] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-black text-white pb-32 font-sans">
      <Toaster position="bottom-center" theme="dark" />

      {/* Шапка */}
      <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 py-4 flex items-center gap-4">
        <Link href="/" className="p-2 -ml-2 rounded-full hover:bg-white/10 transition">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-xl font-bold">Избранное</h1>
      </header>

      {/* Контент */}
      <div className="px-4 py-6">
        {favoritePrompts.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart size={32} className="text-white/20" />
            </div>
            <h3 className="text-lg font-medium text-white/80 mb-2">Здесь пока пусто</h3>
            <p className="text-sm text-white/50 max-w-xs mx-auto mb-6">
              Добавляйте понравившиеся промпты в избранное, чтобы они всегда были под рукой.
            </p>
            <Link href="/" className="px-6 py-2 bg-white text-black rounded-xl font-medium text-sm">
              Искать промпты
            </Link>
          </div>
        ) : (
          /* Сетка карточек */
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {favoritePrompts.map((prompt) => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                favorites={favorites}
                toggleFavorite={(e, id) => actions.toggleFavorite(e, id, favorites)}
                handleCopy={(id, text, price) => actions.handleCopy(id, text, price, setCopiedId)}
                copiedId={copiedId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Навигация */}
      <Navigation />

      {/* Модалки */}
      {isProfileOpen && (
        <ProfileModal 
          user={user} 
          purchases={purchases}
          isProfileOpen={isProfileOpen} 
          setIsProfileOpen={setIsProfileOpen} 
          email="" 
          setEmail={() => {}} 
          password="" 
          setPassword={() => {}} 
          authMode="login" 
          setAuthMode={() => {}} 
          handleAuth={async () => {}} 
          handleTopUp={async () => {}} 
          handleLogout={async () => {}} 
          isTopUpLoading={false} 
        />
      )}
    </div>
  );
}