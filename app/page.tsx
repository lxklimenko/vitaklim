'use client';

import dynamic from 'next/dynamic';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Inter } from 'next/font/google';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase'; 
import { 
  Search, 
  Copy, 
  Sparkles, 
  Home as HomeIcon,
  Star, 
  Plus, 
  Clock, 
  User as UserIcon,
  Image as ImageIcon,
  Calendar,
  Share2,
  Upload,
  Trash2,
  Zap
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { PromptCard } from './components/PromptCard';
import { SkeletonCard, NavItem } from './components/UIElements';
import { CATEGORIES, PROMPTS } from './constants/appConstants';
import { useAuth } from './hooks/useAuth';
import { useImageGeneration } from './hooks/useImageGeneration';
import type { Generation } from './types';

const inter = Inter({ 
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
});

// Загружаем модалки только когда они нужны (Lazy Loading)
const ProfileModal = dynamic(() => import('./components/ProfileModal').then(mod => mod.ProfileModal), {
  ssr: false,
});

const GenerateModal = dynamic(() => import('./components/GenerateModal').then(mod => mod.GenerateModal), {
  ssr: false,
});

const PromptDetailModal = dynamic(() => import('./components/PromptDetailModal').then(mod => mod.PromptDetailModal), {
  ssr: false,
});

export default function App() {
  const { 
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
    isLoading: isAuthLoading 
  } = useAuth();

  const hasLoadedGenerationsRef = useRef(false);

  const {
    generatePrompt, setGeneratePrompt,
    isGenerating,
    modelId, setModelId,
    aspectRatio, setAspectRatio,
    referenceImage,
    handleFileChange, handleRemoveImage, handleGenerate
  } = useImageGeneration(user, () => {
    if (user) {
      hasLoadedGenerationsRef.current = false;
    }
  });

  const [activeCategory, setActiveCategory] = useState("Все");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(6);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<any | null>(null);
  const [isFavoritesView, setIsFavoritesView] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isTopUpLoading, setIsTopUpLoading] = useState(false);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Дебаунс поиска
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Загрузка истории генераций
  useEffect(() => {
    if (user && isHistoryOpen) {
      if (!hasLoadedGenerationsRef.current) {
        fetchGenerations(user.id);
        hasLoadedGenerationsRef.current = true;
      }
    }
    
    if (!user || !isHistoryOpen) {
      hasLoadedGenerationsRef.current = false;
    }
  }, [user, isHistoryOpen, fetchGenerations]);

  // Сброс счетчика при изменении фильтров
  useEffect(() => {
    setVisibleCount(6);
  }, [activeCategory, isFavoritesView, debouncedSearch]);

  // Блокировка скролла при открытой модалке
  useEffect(() => {
    if (selectedPrompt) {
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
      document.body.style.paddingRight = scrollBarWidth > 0 ? `${scrollBarWidth}px` : "";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
      document.body.style.paddingRight = "";
    }

    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
      document.body.style.paddingRight = "";
    };
  }, [selectedPrompt]);

  // Обработчики
  const handleDownload = (url: string, filename: string = 'vision-image.jpg') => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Изображение сохранено!");
  };

  const handleDeleteGeneration = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!user) return;

    try {
      const { error } = await supabase
        .from('generations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setGenerations(prev => prev.filter(gen => gen.id !== id));
      toast.success("Генерация удалена");
    } catch (error: any) {
      console.error('Error deleting generation:', error);
      toast.error("Ошибка при удалении");
    }
  };

  const toggleGenerationFavorite = async (generation: Generation) => {
    if (!user) return;
    
    try {
      const newFavoriteStatus = !generation.is_favorite;
      
      setGenerations(prev => 
        prev.map(gen => 
          gen.id === generation.id 
            ? { ...gen, is_favorite: newFavoriteStatus } 
            : gen
        )
      );

      const { error } = await supabase
        .from('generations')
        .update({ is_favorite: newFavoriteStatus })
        .eq('id', generation.id);

      if (error) {
        setGenerations(prev => 
          prev.map(gen => 
            gen.id === generation.id 
              ? { ...gen, is_favorite: generation.is_favorite } 
              : gen
          )
        );
        toast.error('Ошибка при обновлении избранного');
      } else {
        toast.success(newFavoriteStatus ? 'Добавлено в избранное' : 'Удалено из избранного');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Ошибка при обновлении избранного');
    }
  };

  const handleShare = async (imageUrl: string) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "AI image",
          text: "Сгенерировал с помощью Vision",
          url: imageUrl
        });
        toast.success("Поделились!");
      } else {
        await navigator.clipboard.writeText(imageUrl);
        toast.success("Ссылка скопирована в буфер обмена!");
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error sharing:', error);
        toast.error("Не удалось поделиться");
      }
    }
  };

  const handleAuth = async () => {
    if (!email.includes('@')) return toast.error("Введите корректный email");
    if (password.length < 6) return toast.error("Пароль должен быть не менее 6 символов");
    
    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("С возвращением");
        setIsProfileOpen(false);
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("Аккаунт создан! Проверьте почту для подтверждения.");
        setAuthMode('login');
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleTopUp = async (amount: number) => {
    if (!user) return setIsProfileOpen(true);
    setIsTopUpLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { amount }
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error("Ссылка на оплату не получена");
      }
    } catch (err: any) {
      console.error("Ошибка вызова функции:", err);
      toast.error("Ошибка платежа: " + (err.message || "Неизвестная ошибка"));
    } finally {
      setIsTopUpLoading(false);
    }
  };

  const toggleFavorite = async (e: React.MouseEvent, promptId: number) => {
    e.stopPropagation();
    if (!user) return setIsProfileOpen(true);
    const isFav = favorites.includes(promptId);
    try {
      if (isFav) {
        const { error } = await supabase.from('favorites').delete().eq('user_id', user.id).eq('prompt_id', promptId);
        if (!error) setFavorites(prev => prev.filter(id => id !== promptId));
      } else {
        const { error } = await supabase.from('favorites').insert({ user_id: user.id, prompt_id: promptId });
        if (!error) setFavorites(prev => [...prev, promptId]);
      }
    } catch (err) { toast.error("Ошибка синхронизации"); }
  };

  const handleCopy = async (id: number, text: string, price: number) => {
    if (!user && price > 0) {
      return setIsProfileOpen(true);
    }

    if (price > 0) {
      const { data: canBuy } = await supabase.rpc('can_make_purchase')
      if (!canBuy) return toast.error("Слишком много операций, подожди минуту")

      const { error: spendError } = await supabase.rpc('spend_balance', { amount_to_spend: price });
      if (spendError) return toast.error("Недостаточно средств");
    }

    try {
      await navigator.clipboard.writeText(text);

      if (price > 0 && user) {
        await supabase.from('purchases').insert({
          user_id: user.id,
          prompt_id: id,
          amount: price
        });
      }

      if (user) await fetchProfile(user.id);

      setCopiedId(id);
      toast.success("Скопировано!");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Ошибка");
    }
  };

  // Фильтрация промптов
  const filteredPrompts = useMemo(() => {
    return PROMPTS.filter((p) => {
      const matchesCategory = activeCategory === "Все" || p.category === activeCategory;
      const matchesFavorites = !isFavoritesView || favorites.includes(p.id);
      const matchesSearch = p.title.toLowerCase().includes(debouncedSearch.toLowerCase()) || 
                            p.tool.toLowerCase().includes(debouncedSearch.toLowerCase());
      return matchesCategory && matchesFavorites && matchesSearch;
    });
  }, [activeCategory, isFavoritesView, favorites, debouncedSearch]);

  return (
    <div className={`${inter.className} min-h-screen bg-black text-white selection:bg-white/20 antialiased overflow-x-hidden`}>
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .glass { 
          background: rgba(255, 255, 255, 0.03); 
          backdrop-filter: blur(20px) saturate(180%); 
          -webkit-backdrop-filter: blur(20px) saturate(180%); 
        }
      `}</style>

      <Toaster position="bottom-center" theme="dark" />

      {/* NAVBAR */}
      <header className="sticky top-0 z-[100] glass border-b border-white/[0.05] pt-safe">
        <div className="max-w-7xl mx-auto px-6 h-[64px] flex items-center justify-between gap-4">
          <div 
            className={`flex items-center gap-2 cursor-pointer transition-all duration-500 active:scale-95 ${isSearchActive ? 'opacity-0 w-0 md:opacity-100 md:w-auto overflow-hidden' : 'opacity-100'}`} 
            onClick={() => { 
              setIsFavoritesView(false); 
              setIsProfileOpen(false); 
              setIsHistoryOpen(false); 
              window.scrollTo({ top: 0, behavior: 'smooth' }); 
            }}
          >
            <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center">
              <Sparkles size={16} className="text-black" />
            </div>
            <span className="text-base font-semibold tracking-tight hidden sm:inline">Vision</span>
          </div>

          <div className={`flex-grow flex items-center gap-2 bg-[#1c1c1e] rounded-full px-4 py-2.5 transition-all duration-500 border ${isSearchActive ? 'border-white/10 ring-4 ring-white/5' : 'border-transparent'}`}>
            <Search size={16} className="text-white/30" />
            <input 
              type="text" 
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchActive(true)}
              onBlur={() => !searchQuery && setIsSearchActive(false)}
              className="bg-transparent border-none outline-none text-[14px] w-full text-white placeholder:text-white/30 font-medium"
            />
          </div>

          <button 
            onClick={() => setIsProfileOpen(true)} 
            className="text-[12px] font-semibold text-white/70 hover:text-white transition-colors duration-500 select-none flex-shrink-0 px-2 tracking-tight"
          >
            {user ? user.email?.split('@')[0] : "Войти"}
          </button>
        </div>
      </header>

      <main className="pb-28 pt-8">
        {!isFavoritesView && !searchQuery && !isHistoryOpen && (
          <div className="mb-6 px-4 text-center">
            <h1 className="text-[32px] md:text-5xl font-bold tracking-tighter mb-1 text-white">
              Создавай шедевры
            </h1>
            <p className="text-[13px] md:text-base text-white/40 max-w-xl mx-auto leading-relaxed">
              Маркетплейс премиальных промптов.
            </p>
          </div>
        )}

        {!isHistoryOpen && (
          <section className="max-w-7xl mx-auto mb-6 flex justify-start md:justify-center gap-1.5 overflow-x-auto no-scrollbar px-6">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => { 
                  setActiveCategory(cat); 
                  setIsFavoritesView(false); 
                  setIsHistoryOpen(false); 
                }}
                className={`px-5 py-2 rounded-full text-[13px] font-semibold tracking-tight border transition-all duration-500 ease-out flex-shrink-0 ${
                  activeCategory === cat && !isFavoritesView && !isHistoryOpen
                    ? 'bg-white text-black border-white shadow-md shadow-black/20' 
                    : 'bg-transparent text-white/40 border-transparent hover:text-white/60'
                }`}
              >
                {cat}
              </button>
            ))}
          </section>
        )}

        <section className="max-w-7xl mx-auto pb-20">
          {isHistoryOpen ? (
            <div className="px-4">
              <div className="mb-6 text-center">
                <h2 className="text-2xl font-bold tracking-tight mb-2 text-white">История генераций</h2>
                <p className="text-sm text-white/40">Ваши созданные изображения</p>
              </div>
              
              {!user ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/5">
                    <Clock size={24} className="text-white/20" />
                  </div>
                  <h3 className="text-sm font-semibold tracking-tight text-white/40 mb-2">Войдите в аккаунт</h3>
                  <p className="text-xs text-white/20 mb-6">История генераций доступна только авторизованным пользователям</p>
                  <button 
                    onClick={() => setIsProfileOpen(true)}
                    className="px-6 py-3 rounded-xl bg-white text-black font-semibold text-sm active:scale-95 transition"
                  >
                    Войти
                  </button>
                </div>
              ) : generations.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/5">
                    <ImageIcon size={24} className="text-white/20" />
                  </div>
                  <h3 className="text-sm font-semibold tracking-tight text-white/40 mb-2">Пока пусто</h3>
                  <p className="text-xs text-white/20">Создайте первое изображение в генераторе</p>
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-2 gap-4"
                >
                  {generations.map((generation) => (
                    <div 
                      key={generation.id} 
                      className="rounded-[1.5rem] bg-white/[0.02] border border-white/[0.03] overflow-hidden relative group cursor-pointer"
                      onClick={() => setSelectedPrompt({
                        id: generation.id as any,
                        title: "Моя генерация",
                        tool: "Vision AI",
                        category: "История",
                        price: 0,
                        prompt: generation.prompt,
                        image: { src: generation.image_url, width: 1024, height: 1024, aspect: "1:1" },
                        description: "Сгенерированное изображение",
                        bestFor: "Личное использование",
                        isHistory: true
                      })}
                    >
                      <button
                        onClick={(e) => handleDeleteGeneration(e, generation.id)}
                        className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/60 backdrop-blur-sm hover:bg-red-500/80 text-white/60 hover:text-white transition-all"
                        title="Удалить из истории"
                      >
                        <Trash2 size={18} />
                      </button>
                      
                      <div className="aspect-square bg-black/40 relative overflow-hidden">
                        <img 
                          src={generation.image_url} 
                          alt="Generated" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      
                      <div className="p-4 space-y-3">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-3 h-24 overflow-y-auto">
                          <p className="text-xs leading-relaxed text-white/90 whitespace-pre-wrap select-all font-medium">
                            {generation.prompt}
                          </p>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs text-white/30">
                          <div className="flex items-center gap-1">
                            <Calendar size={12} />
                            <span>{new Date(generation.created_at).toLocaleDateString('ru-RU')}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                navigator.clipboard.writeText(generation.prompt); 
                                toast.success("Промпт скопирован!"); 
                              }}
                              className="hover:text-white/60 transition-colors"
                              title="Копировать промпт"
                            >
                              <Copy size={14} />
                            </button>
                            
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setGeneratePrompt(generation.prompt); 
                                setIsGenerateOpen(true); 
                              }}
                              className="hover:text-white/60 transition-colors"
                              title="Сгенерировать снова"
                            >
                              <Zap size={14} />
                            </button>
                            
                            <button 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                handleShare(generation.image_url); 
                              }}
                              className="hover:text-white/60 transition-colors"
                              title="Поделиться"
                            >
                              <Share2 size={14} />
                            </button>
                            
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(generation.image_url, `generation-${generation.id}.jpg`);
                              }}
                              className="hover:text-white/60 transition-colors"
                              title="Скачать"
                            >
                              <Upload size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 px-4">
                {isAuthLoading && filteredPrompts.length === 0 ? (
                  Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={`skeleton-${i}`} />)
                ) : (
                  filteredPrompts.slice(0, visibleCount).map((p, index) => (
                    <PromptCard 
                      key={p.id}
                      prompt={p}
                      priority={index === 0} // ПЕРВАЯ КАРТИНКА ГРУЗИТСЯ ПРИОРИТЕТНО
                      favorites={favorites}
                      toggleFavorite={toggleFavorite}
                      handleCopy={handleCopy}
                      setSelectedPrompt={setSelectedPrompt as any}
                      copiedId={copiedId}
                    />
                  ))
                )}
              </div>
              
              {filteredPrompts.length > visibleCount && !isAuthLoading && (
                <div className="mt-8 flex justify-center px-4">
                  <button
                    onClick={() => setVisibleCount(prev => prev + 6)}
                    className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-white/60 font-medium active:scale-[0.98] transition-all hover:text-white/80"
                  >
                    Показать больше
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {/* НИЖНИЙ БАР */}
      <nav className="fixed bottom-0 left-0 right-0 z-[110] md:hidden pb-safe glass border-t border-white/[0.03]">
        <div className="relative h-14 px-6 flex items-center justify-between">
          <NavItem 
            icon={<HomeIcon size={18} />} 
            label="Дом" 
            active={!isFavoritesView && !isProfileOpen && !isHistoryOpen} 
            onClick={() => { 
              setIsFavoritesView(false); 
              setIsProfileOpen(false); 
              setIsHistoryOpen(false); 
            }} 
          />
          
          <NavItem 
            icon={<Star size={18} />} 
            label="Избранное" 
            active={isFavoritesView} 
            onClick={() => { 
              setIsFavoritesView(true); 
              setIsProfileOpen(false); 
              setIsHistoryOpen(false); 
            }} 
          />
          
          <div className="relative -mt-8 flex justify-center">
            <button 
              onClick={() => setIsGenerateOpen(true)}
              className="w-14 h-14 rounded-2xl bg-white text-black flex items-center justify-center shadow-[0_8px_30px_rgb(255,255,255,0.2)] active:scale-90 transition-all border-[6px] border-black"
            >
              <Plus size={28} strokeWidth={3} />
            </button>
          </div>
          
          <NavItem 
            icon={<Clock size={18} />} 
            label="История" 
            active={isHistoryOpen} 
            onClick={() => { 
              setIsHistoryOpen(true); 
              setIsFavoritesView(false); 
              setIsProfileOpen(false); 
            }} 
          />
          
          <NavItem 
            icon={<UserIcon size={18} />} 
            label="Профиль" 
            active={isProfileOpen} 
            onClick={() => { 
              setIsProfileOpen(true); 
              setIsFavoritesView(false); 
              setIsHistoryOpen(false); 
            }} 
          />
        </div>
      </nav>

      {/* МОДАЛКИ */}
      {isProfileOpen && (
        <ProfileModal
          user={user}
          balance={balance}
          purchases={purchases}
          isProfileOpen={isProfileOpen}
          setIsProfileOpen={setIsProfileOpen}
          handleTopUp={handleTopUp}
          isTopUpLoading={isTopUpLoading}
          email={email}
          password={password}
          setEmail={setEmail}
          setPassword={setPassword}
          authMode={authMode}
          setAuthMode={setAuthMode}
          handleAuth={handleAuth}
        />
      )}

      {selectedPrompt && (
        <PromptDetailModal
          selectedPrompt={selectedPrompt}
          onClose={() => setSelectedPrompt(null)}
          favorites={favorites}
          toggleFavorite={toggleFavorite}
          toggleGenerationFavorite={toggleGenerationFavorite}
          generations={generations}
          handleCopy={handleCopy}
          handleDownload={handleDownload}
          copiedId={copiedId}
          setIsGenerateOpen={setIsGenerateOpen}
          setGeneratePrompt={setGeneratePrompt}
        />
      )}

      {isGenerateOpen && (
        <GenerateModal
          isOpen={isGenerateOpen}
          onClose={() => setIsGenerateOpen(false)}
          generatePrompt={generatePrompt}
          setGeneratePrompt={setGeneratePrompt}
          isGenerating={isGenerating}
          handleGenerate={handleGenerate}
          modelId={modelId}
          setModelId={setModelId}
          aspectRatio={aspectRatio}
          setAspectRatio={setAspectRatio}
          referenceImage={referenceImage}
          handleFileChange={handleFileChange}
          handleRemoveImage={handleRemoveImage}
        />
      )}
    </div>
  );
}