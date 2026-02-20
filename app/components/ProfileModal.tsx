'use client';

import React, { useState } from 'react';
import { X, Plus, History, Coins, LogOut } from 'lucide-react';
import { toast } from 'sonner';

interface ProfileModalProps {
  user: any;
  purchases: any[];
  isProfileOpen: boolean;
  setIsProfileOpen: (open: boolean) => void;
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  authMode: 'login' | 'register';
  setAuthMode: (mode: 'login' | 'register') => void;
  handleAuth: (e: React.FormEvent) => Promise<void>;
  handleTopUp: (amount: number) => Promise<void>; // теперь принимает сумму
  handleLogout: () => Promise<void>; // добавили проп для выхода
  isTopUpLoading: boolean;
}

export function ProfileModal({
  user,
  purchases,
  isProfileOpen,
  setIsProfileOpen,
  email,
  setEmail,
  password,
  setPassword,
  authMode,
  setAuthMode,
  handleAuth,
  handleTopUp,
  handleLogout,
  isTopUpLoading
}: ProfileModalProps) {
  const [showTopUp, setShowTopUp] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);

  if (!isProfileOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) setIsProfileOpen(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const onTopUp = async () => {
    if (!selectedAmount) {
      toast.error('Выберите сумму пополнения');
      return;
    }
    await handleTopUp(selectedAmount);
    setShowTopUp(false);
    setSelectedAmount(null);
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end justify-center z-150"
      onClick={handleOverlayClick}
    >
      <div className="bg-[#1a1a1a] w-full max-w-md rounded-t-3xl border border-white/10 shadow-2xl animate-slide-up">
        {/* Заголовок */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-xl font-semibold">
            {user ? 'Профиль' : 'Вход / Регистрация'}
          </h2>
          <button
            onClick={() => setIsProfileOpen(false)}
            className="p-2 rounded-full hover:bg-white/10 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Контент */}
        <div className="p-5 max-h-[70vh] overflow-y-auto">
          {!user ? (
            // Форма авторизации
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/20"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1">Пароль</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/20"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-white text-black font-medium rounded-xl hover:bg-white/90 transition"
              >
                {authMode === 'login' ? 'Войти' : 'Зарегистрироваться'}
              </button>

              <p className="text-center text-sm text-white/40">
                {authMode === 'login' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}{' '}
                <button
                  type="button"
                  onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                  className="text-white/80 underline"
                >
                  {authMode === 'login' ? 'Создать' : 'Войти'}
                </button>
              </p>
            </form>
          ) : (
            // Профиль пользователя
            <div className="space-y-6">
              {/* Информация о пользователе */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-linear-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl font-bold">
                  {user.email?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1">
                  <p className="font-medium truncate">{user.email}</p>
                  <p className="text-sm text-white/40">ID: {user.id?.slice(0, 8) || '...'}</p>
                </div>
              </div>

              {/* Баланс и пополнение */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Coins size={20} className="text-yellow-400" />
                    <span className="font-medium">Баланс</span>
                  </div>
                  <span className="text-xl font-bold">{user.balance || 0} ₽</span>
                </div>
                {!showTopUp ? (
                  <button
                    onClick={() => setShowTopUp(true)}
                    className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition"
                  >
                    <Plus size={16} />
                    Пополнить
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      {[100, 300, 500, 1000].map((amount) => (
                        <button
                          key={amount}
                          onClick={() => setSelectedAmount(amount)}
                          className={`flex-1 py-2 rounded-lg text-sm transition ${
                            selectedAmount === amount
                              ? 'bg-white text-black'
                              : 'bg-white/10 hover:bg-white/20'
                          }`}
                        >
                          {amount} ₽
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={onTopUp}
                      disabled={isTopUpLoading || !selectedAmount}
                      className="w-full py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-white/90 transition disabled:opacity-50"
                    >
                      {isTopUpLoading ? 'Обработка...' : 'Пополнить'}
                    </button>
                    <button
                      onClick={() => {
                        setShowTopUp(false);
                        setSelectedAmount(null);
                      }}
                      className="text-xs text-white/40 hover:text-white/60"
                    >
                      Отмена
                    </button>
                  </div>
                )}
              </div>

              {/* История покупок */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <History size={18} className="text-white/40" />
                  <h3 className="font-medium">История покупок</h3>
                </div>
                {purchases && purchases.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {purchases.map((purchase) => (
                      <div
                        key={purchase.id}
                        className="bg-white/5 rounded-lg p-3 border border-white/10"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-medium line-clamp-1">
                              {purchase.prompt?.title || 'Промпт'}
                            </p>
                            <p className="text-xs text-white/40">
                              {formatDate(purchase.created_at)}
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-yellow-400">
                            -{purchase.amount} ₽
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-white/40 text-center py-4">
                    У вас пока нет покупок
                  </p>
                )}
              </div>

              {/* Кнопка выхода */}
              <button
                onClick={handleLogout}
                className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition"
              >
                <LogOut size={16} />
                Выйти
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Стили для анимации */}
      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}