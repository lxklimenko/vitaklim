'use client';

// app/page.tsx

console.log("PAGE VERSION ALEX 999 - FULL STACK READY");

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase'; 
import type { User } from '@supabase/supabase-js';
import { 
  Search, 
  Copy, 
  Sparkles, 
  Check, 
  X, 
  Home as HomeIcon,
  Star, 
  Plus, 
  Clock, 
  User as UserIcon,
  Heart,
  Send,
  Zap,
  Loader2,
  UserPlus,
  Image as ImageIcon,
  Calendar,
  ExternalLink,
  Share2,
  ChevronLeft, 
  ChevronDown, 
  HelpCircle,
  Upload,
  Download,
  Trash2
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { PromptCard } from './components/PromptCard';
import { ProfileModal } from './components/ProfileModal';
import { GenerateModal } from './components/GenerateModal';
import { PromptDetailModal } from './components/PromptDetailModal'; // Импортируем новый компонент
// Импортируем компоненты из UIElements.tsx
import { SkeletonCard, NavItem } from './components/UIElements';
import { STORAGE_URL, CATEGORIES, PROMPTS, MODELS } from './constants/appConstants';
// Импортируем хук useAuth
import { useAuth } from './hooks/useAuth';
// Импортируем типы
import { Generation } from './types';

export default function App() {
  // Используем хук useAuth для получения данных пользователя
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

  const [activeCategory, setActiveCategory] = useState("Все");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);
   
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<any | null>(null);
  const [isFavoritesView, setIsFavoritesView] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isTopUpLoading, setIsTopUpLoading] = useState(false);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  // Состояния для генерации изображений
  const [generatePrompt, setGeneratePrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  
  // Обновленные состояния для модели
  const [modelId, setModelId] = useState(MODELS[0].id);
  const currentModel = MODELS.find(m => m.id === modelId) || MODELS[0];
  
  // Состояние для соотношения сторон
  const [aspectRatio, setAspectRatio] = useState("auto");
  const [isRatioMenuOpen, setIsRatioMenuOpen] = useState(false);

  // Состояние для открытия/закрытия меню моделей
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Новое состояние для референсного изображения
  const [referenceImage, setReferenceImage] = useState<string | null>(null);

  // Функция для обработки выбора файла
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReferenceImage(reader.result as string); // Сохраняем как Base64
      };
      reader.readAsDataURL(file);
    }
  };

  // Функция для удаления загруженного изображения
  const handleRemoveImage = () => {
    setReferenceImage(null);
  };

  // Функция для скачивания изображения
  const handleDownload = (url: string, filename: string = 'vision-image.jpg') => {
    const link = document.createElement('a');
    link.href = url; // Используем base64 URL изображения 
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Изображение сохранено!");
  };

  // Функция для удаления генерации
  const handleDeleteGeneration = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Чтобы не открывалась модалка при клике на кнопку
    if (!user) return;

    try {
      const { error } = await supabase
        .from('generations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Обновляем локальный стейт, чтобы карточка исчезла сразу
      setGenerations(prev => prev.filter(gen => gen.id !== id));
      toast.success("Генерация удалена");
    } catch (error: any) {
      console.error('Error deleting generation:', error);
      toast.error("Ошибка при удалении");
    }
  };

  // ИСПРАВЛЕННЫЙ useEffect для блокировки скролла
  useEffect(() => {
    if (selectedPrompt) {
      const scrollBarWidth =
          window.innerWidth - document.documentElement.clientWidth;

      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
      document.body.style.paddingRight =
          scrollBarWidth > 0 ? `${scrollBarWidth}px` : "";
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

  // Функция для переключения избранного
  const toggleGenerationFavorite = async (generation: Generation) => {
    if (!user) return;
    
    try {
      const newFavoriteStatus = !generation.is_favorite;
      
      // Оптимистичное обновление
      setGenerations(prev => 
        prev.map(gen => 
          gen.id === generation.id 
            ? { ...gen, is_favorite: newFavoriteStatus } 
            : gen
        )
      );

      // Обновление в базе данных
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

  // Функция для шаринга изображения
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

  const filteredPrompts = useMemo(() => {
    return PROMPTS.filter((p) => {
      const matchesCategory = activeCategory === "Все" || p.category === activeCategory;
      const matchesFavorites = !isFavoritesView || favorites.includes(p.id);
      const matchesSearch = p.title.toLowerCase().includes(debouncedSearch.toLowerCase()) || 
                            p.tool.toLowerCase().includes(debouncedSearch.toLowerCase());
      return matchesCategory && matchesFavorites && matchesSearch;
    });
  }, [activeCategory, isFavoritesView, favorites, debouncedSearch]);

  // Фильтрация генераций
  const filteredGenerations = useMemo(() => {
    return generations;
  }, [generations]);

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

      if (price > 0) {
        if (!user) return;

        await supabase.from('purchases').insert({
          user_id: user.id,
          prompt_id: id,
          amount: price
        })
      }

      if (user) await fetchProfile(user.id);

      setCopiedId(id);
      toast.success(`Скопировано!`);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Ошибка");
    }
  };

  // Функция генерации изображения
  const handleGenerate = async () => {
    if (!generatePrompt.trim()) return;

    setIsGenerating(true);
    setImageUrl(null);

    try {
      const res = await fetch("/api/generate-google/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          prompt: generatePrompt,
          modelId: modelId,
          aspectRatio: aspectRatio === "auto" ? "1:1" : aspectRatio,
          image: referenceImage // Отправляем строку Base64 (включая заголовок data:image/...)
        }),
      });

      const data = await res.json();
      
      if (res.ok) {
        setImageUrl(data.imageUrl);
        toast.success("Изображение сгенерировано!");
        
        if (user) {
          await supabase.from('generations').insert({
            user_id: user.id,
            prompt: generatePrompt,
            image_url: data.imageUrl,
            is_favorite: false
          });
          
          await fetchGenerations(user.id);
        }
      } else {
        toast.error(data.error || "Ошибка генерации");
      }
    } catch (error) {
      console.error("Ошибка при генерации:", error);
      toast.error("Ошибка соединения с сервером");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white/20 antialiased overflow-x-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .glass { 
          background: rgba(255, 255, 255, 0.03); 
          backdrop-filter: blur(20px) saturate(180%); 
          -webkit-backdrop-filter: blur(20px) saturate(180%); 
        }
        .hidden { display: none !important; }
      `}</style>

      <Toaster position="bottom-center" theme="dark" />

      {/* NAVBAR */}
      <header className="sticky top-0 z-[100] glass border-b border-white/[0.05] pt-safe">
        <div className="max-w-7xl mx-auto px-6 h-[64px] flex items-center justify-between gap-4">
          <div 
            className={`flex items-center gap-2 cursor-pointer transition-all duration-500 active:scale-95 ${isSearchActive ? 'opacity-0 w-0 md:opacity-100 md:w-auto overflow-hidden' : 'opacity-100'}`} 
            onClick={() => { setIsFavoritesView(false); setIsProfileOpen(false); setIsHistoryOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          >
            <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center">
              <span className="text-black"><Sparkles size={16} /></span>
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

          <button onClick={() => setIsProfileOpen(true)} className="text-[12px] font-semibold text-white/70 hover:text-white transition-colors duration-500 select-none flex-shrink-0 px-2 tracking-tight">
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
                onClick={() => { setActiveCategory(cat); setIsFavoritesView(false); setIsHistoryOpen(false); }}
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
              ) : filteredGenerations.length === 0 ? (
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
                  {filteredGenerations.map((generation) => (
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
                      {/* Кнопка удаления вместо избранного */}
                      <button
                        onClick={(e) => handleDeleteGeneration(e, generation.id)}
                        className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/60 backdrop-blur-sm hover:bg-red-500/80 text-white/60 hover:text-white transition-all group/del"
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
                              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(generation.prompt); toast.success("Промпт скопирован!"); }}
                              className="hover:text-white/60 transition-colors"
                              title="Копировать промпт"
                            >
                              <Copy size={14} />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); setGeneratePrompt(generation.prompt); setIsGenerateOpen(true); }}
                              className="hover:text-white/60 transition-colors"
                              title="Сгенерировать снова"
                            >
                              <Zap size={14} />
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleShare(generation.image_url); }}
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
            /* ИЗМЕНЕНИЕ №1: Убираем motion.div и AnimatePresence */
            <div className="grid grid-cols-2 gap-4 px-4">
              {isAuthLoading ? (
                Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={`skeleton-${i}`} />)
              ) : (isFavoritesView && filteredPrompts.length === 0) ? (
                <div 
                  key="empty-state"
                  className="col-span-2 py-24 text-center flex flex-col items-center gap-4"
                >
                  <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5">
                    <Heart size={24} className="text-white/10" />
                  </div>
                  <h3 className="text-sm font-semibold tracking-tight text-white/40">Пусто</h3>
                </div>
              ) : (
                filteredPrompts.map((p) => (
                  <PromptCard 
                    key={p.id}
                    prompt={p}
                    favorites={favorites}
                    toggleFavorite={toggleFavorite}
                    handleCopy={handleCopy}
                    setSelectedPrompt={setSelectedPrompt as any}
                    copiedId={copiedId}
                  />
                ))
              )}
            </div>
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

      {/* PROFILE MODAL */}
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

      {/* DETAIL MODAL COMPONENT */}
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

      {/* GENERATE MODAL COMPONENT */}
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
    </div>
  );
}