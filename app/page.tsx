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
  Share2
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { PromptCard } from './components/PromptCard';
import { ProfileModal } from './components/ProfileModal';
import { Prompt } from './types/prompt';

/**
 * 2. КОНСТАНТЫ И ПОЛНЫЕ ДАННЫЕ
 */
const STORAGE_URL = "https://gmngqxwkgnuqtkwndjwx.supabase.co/storage/v1/object/public/prompts-images/";
const CATEGORIES = ["Все", "Fashion", "Art", "Product", "Interior", "Lifestyle"];

const PROMPTS: Prompt[] = [
  {
    id: 1,
    title: "Промпт «Газеты»",
    tool: "Nano Banano Pro", 
    category: "Fashion",
    price: 15,
    prompt: `Создайте сцену, где молодая женщина в черном костюме в тонкую полоску, стоит в узкой комнате с английскими газетами на стенах. Она прислонена к углу с руками в карманах, волосы в небрежный пучок. Макияж winter glam, выражение лица серьезное. Снимок с теплым светом и мягкой резкостью, 35 мм объектив, киностиль. Используя представленные фото создай сцену где изображен кинематографический портрет молодой женщины в узкой комнате, стены которой полностью покрыты старыми Английскими газетами. Она небрежно прислонилась к углу, одним плечом опираясь о стену, Она одета в черный костюм в тонкую полоску с укороченным пиджаком, белую рубашку и черный галстук. Руки женщины- в карманах. Длинные волосы уложены в небрежный повседневный пучок, Макияж winter glam: выразительные брови, мягкая стрелка, аккуратные ресницы, губы нюд-розовые/розово-карамельные с влажным глянцем. Единственная лампа накаливания свисает с потолка над ней, создавая теплый оранжевый свет и мягкие тени, с тонким сине-зеленым оттенком на заднем плане. Вертикальный снимок, угол съемки на уровне глаз, небольшая глубина резкости, мягкий фокус на заднем плане, детализированные черты лица, слегка серьезное выражение. Высокое разрешение, ультрареалистичность, объектив 35 мм, f/1.8, цветовая градиентная коррекция в стиле кино, атмосферная, редакционная модная фотография.`,
    image: { src: `${STORAGE_URL}photo.webp`, width: 1000, height: 1250, aspect: "4:5" },
    description: "Кинематографичный fashion-портрет в стиле ретро-декора.",
    bestFor: "Fashion Brands / Lookbooks"
  },
  {
    id: 2,
    title: "Промпт «Портрет»",
    tool: "Nano Banano Pro", 
    category: "Art",
    price: 0,
    prompt: `СТРОГО СОХРАНИ ВНЕШНОСТЬ девушки с прикреплённого фото, 1:1 её настоящее лицо, глаза, нос, кожа с порами - всё 100% без изменений. Используй отправленное фото как эталон. Ультрареалистичный beauty-portrait крупным планом (голова+плечи, крупный кадр), студийная съёмка на тёмно серым фоне. Поза: 3/4 поворот головы, взгляд прямо в камеру, подбородок слегка приподнят. Причёска - высокий гладкий хвост, идеально зачесанный лаком. Макияж глянцевый, стеклянный тон, тёплый контуринг, идеальные брови, суперчёткие длинные стрелки (cat-eye), длинные объёмные ресницы, нюдово-карамельные глянцевые губы с чётким контуром. Украшения: сверкающие серьги в форме цветка из камней. На пальцах крупные бриллиантовые кольца (одно с большим камнем). Свет мягкий beauty light, акцент на текстуре кожи и блеске украшений. Тени добавляют объём. Атмосфера - редакционная съёмка`,
    image: { src: `${STORAGE_URL}photo1.webp`, width: 1024, height: 1024, aspect: "1:1" },
    description: "Ультрареалистичный бьюти -портрет с акцентом на кожу.",
    bestFor: "Art / Creative Posters"
  },
  {
    id: 3,
    title: "Промпт «Шампанское»",
    tool: "Nano Banano Pro",
    category: "Fashion",
    price: 3,
    prompt: `ВАЖНО: Используй загруженное селфи как точную визуальную основу. Лицо должно быть узнаваемым на 100%, без изменения анатомии, мимики, кожи, глаз, губ и волос. Ультрареалистичный новогодний fashion-портрет в студии. Девушка по пояс/до середины бёдер. Её выразительное лицо с мягким макияжем делает образ особенно притягательным и камерным. На девушке круглые большие золотые серьги. Волосы уложены в небрежный высокий пучок. На ней праздничное черное облегающее боди с высоким воротом, красный бархатный элемент и черные капроновые колготки. В руках она держит бутылку и бокал шампанского. Кадр в мягком студийном освещении, подчеркивающем текстуру ткани и детали. Общее настроение — гламурное и провокационное, в стиле модной журнальной статьи. Высокая детализация, 8k, кинематографичный свет.`,
    image: { src: `${STORAGE_URL}photo3.webp`, width: 1024, height: 1024, aspect: "1:1" },
    description: "Праздничный гламурный образ с шампанским.",
    bestFor: "Interior Design / Web"
  },
  {
    id: 4,
    title: "Промпт «Машина»",
    tool: "Nano Banano Pro",
    category: "Fashion",
    price: 12,
    prompt: `Используя представленное фото как эталон, СТРОГО СОХРАНИ черты лица, мимику и взгляд женщины без изменений. Создай потрясающий портрет высокой чёткости в формате 9:16. Женщина с объёмными волнистыми волосами, пара прядей небрежно падает на лицо. Она одета в стильную серую двубортную дубленку с отделкой из белой овчины и большим английским воротником, тёмно-серое обтягивающее плотное трико и светлые дутые сапоги в тон меху. Макияж: легкий, чёткие чёрные стрелки, пышные ресницы, губы с коричневым матовым оттенком. Ногти покрашены в белый цвет. Она сидит в открытом багажнике большого белого внедорожника в горах зимой, одна нога игриво согнута. Поза в стиле профессиональной фэшн-съёмки (гламур и дерзость). Кадр по пояс. Освещение природное, мягкое, в спокойных серо-бирюзовых тонах зимнего солнечного дня. Фон горного пейзажа не размыт, видна текстура снега. Фото имеет легкую эстетичную зернистость пленки. Композиция подчеркивает элегантность наряда и красоту модели.`,
    image: { src: `${STORAGE_URL}photo4.webp`, width: 1080, height: 1920, aspect: "9:16" },
    description: "Зимняя fashion-съемка в горах.",
    bestFor: "Instagram / Lookbook"
  }
];

/**
 * 3. ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ
 */
function SkeletonCard() {
  return (
    <div className="rounded-[1.5rem] bg-white/[0.02] border border-white/[0.03] overflow-hidden flex flex-col h-full animate-pulse">
      <div className="aspect-[4/5] bg-white/5" />
      <div className="p-2 space-y-2">
        <div className="h-2 w-1/2 bg-white/5 rounded-full" />
        <div className="h-3 w-full bg-white/5 rounded-full" />
        <div className="h-8 w-full bg-white/5 rounded-xl mt-2" />
      </div>
    </div>
  );
}

function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="flex flex-col items-center gap-1 text-[9px] font-medium transition-all duration-500 ease-out active:scale-95 select-none"
    >
      <div className={active ? 'text-white' : 'text-white/20'}>
        {icon}
      </div>
      <span className={`tracking-tight ${active ? 'text-white font-semibold' : 'text-white/20'}`}>
        {label}
      </span>
    </button>
  );
}

// Тип для генераций
interface Generation {
  id: string;
  user_id: string;
  prompt: string;
  image_url: string;
  created_at: string;
  is_favorite: boolean;
}

/**
 * 4. ОСНОВНОЙ КОМПОНЕНТ ПРИЛОЖЕНИЯ
 */
export default function App() {
  const [activeCategory, setActiveCategory] = useState("Все");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);
   
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [favorites, setFavorites] = useState<number[]>([]);
  const [isFavoritesView, setIsFavoritesView] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isTopUpLoading, setIsTopUpLoading] = useState(false);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  // Состояния для генерации изображений
  const [generatePrompt, setGeneratePrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  
  // Добавляем состояние для выбора модели
  const [model, setModel] = useState<"openai" | "google">("openai");

  const [user, setUser] = useState<User | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isLibLoading, setIsLibLoading] = useState(true);

  // ИСПРАВЛЕННЫЙ useEffect для блокировки скролла
  useEffect(() => {
    if (selectedPrompt) {
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
    } else {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    }

    return () => {
      document.body.style.overflow = "";
      document.body.style.touchAction = "";
    };
  }, [selectedPrompt]);

  const fetchFavorites = async (userId: string) => {
    const { data, error } = await supabase.from('favorites').select('prompt_id').eq('user_id', userId);
    if (!error && data) setFavorites(data.map((f: any) => f.prompt_id));
  };

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase.from('profiles').select('balance').eq('id', userId).single();
    if (!error && data) setBalance(data.balance);
  };

  const fetchPurchases = async (userId: string) => {
    const { data, error } = await supabase
      .from('purchases')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (!error && data) setPurchases(data)
  };

  const fetchGenerations = async (userId: string) => {
    const { data, error } = await supabase
      .from('generations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (!error && data) setGenerations(data)
  };

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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchFavorites(session.user.id);
        fetchProfile(session.user.id);
        fetchPurchases(session.user.id);
        fetchGenerations(session.user.id);
      }
      setIsLibLoading(false);
    });

    const { data: authData } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchFavorites(session.user.id);
        fetchProfile(session.user.id);
        fetchPurchases(session.user.id);
        fetchGenerations(session.user.id);
      } else {
        setFavorites([]);
        setBalance(0);
        setPurchases([]);
        setGenerations([]);
      }
    });

    return () => authData.subscription.unsubscribe();
  }, []);

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

  // Фильтрация генераций по избранным
  const filteredGenerations = useMemo(() => {
    if (showOnlyFavorites) {
      return generations.filter(gen => gen.is_favorite);
    }
    return generations;
  }, [generations, showOnlyFavorites]);

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

      if (user) await fetchPurchases(user.id);
      if (user) fetchProfile(user.id);

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
      const endpoint = model === "openai" ? "/api/generate/" : "/api/generate-google/";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: generatePrompt }),
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
                
                {/* Фильтр "Только избранные" */}
                {user && generations.length > 0 && (
                  <div className="mt-4">
                    <button
                      onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        showOnlyFavorites 
                          ? 'bg-yellow-500 text-black' 
                          : 'bg-white/5 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {showOnlyFavorites ? 'Все генерации' : 'Только избранные'}
                    </button>
                  </div>
                )}
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
                  <h3 className="text-sm font-semibold tracking-tight text-white/40 mb-2">
                    {showOnlyFavorites ? 'Нет избранных генераций' : 'Пока пусто'}
                  </h3>
                  <p className="text-xs text-white/20">
                    {showOnlyFavorites ? 'Добавьте генерации в избранное, нажав на звездочку' : 'Создайте первое изображение в генераторе'}
                  </p>
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
                      className="rounded-[1.5rem] bg-white/[0.02] border border-white/[0.03] overflow-hidden relative group"
                    >
                      {/* Кнопка избранного */}
                      <button
                        onClick={() => toggleGenerationFavorite(generation)}
                        className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/60 backdrop-blur-sm hover:bg-black/80 transition-all"
                        title={generation.is_favorite ? "Удалить из избранного" : "Добавить в избранное"}
                      >
                        <Star 
                          size={18} 
                          className={generation.is_favorite ? "text-yellow-400 fill-yellow-400" : "text-white/60"} 
                        />
                      </button>
                      
                      <div className="aspect-square bg-black/40 relative overflow-hidden">
                        <img 
                          src={generation.image_url} 
                          alt="Generated" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-4 space-y-3">
                        {/* ОБНОВЛЁННЫЙ БЛОК С ПРОМПТОМ */}
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
                              onClick={() => {
                                navigator.clipboard.writeText(generation.prompt);
                                toast.success("Промпт скопирован!");
                              }}
                              className="hover:text-white/60 transition-colors"
                              title="Копировать промпт"
                            >
                              <Copy size={14} />
                            </button>
                            <button 
                              onClick={() => {
                                setGeneratePrompt(generation.prompt);
                                setIsGenerateOpen(true);
                              }}
                              className="hover:text-white/60 transition-colors"
                              title="Сгенерировать снова"
                            >
                              <Zap size={14} />
                            </button>
                            <button 
                              onClick={() => handleShare(generation.image_url)}
                              className="hover:text-white/60 transition-colors"
                              title="Поделиться"
                            >
                              <Share2 size={14} />
                            </button>
                            <a 
                              href={generation.image_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="hover:text-white/60 transition-colors"
                              title="Открыть изображение"
                            >
                              <ExternalLink size={14} />
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </div>
          ) : (
            <motion.div layout className="grid grid-cols-2 gap-4 px-4">
              <AnimatePresence mode="popLayout">
                {isLibLoading ? (
                  Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={`skeleton-${i}`} />)
                ) : (isFavoritesView && filteredPrompts.length === 0) ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    key="empty-state"
                    className="col-span-2 py-24 text-center flex flex-col items-center gap-4"
                  >
                    <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5">
                      <Heart size={24} className="text-white/10" />
                    </div>
                    <h3 className="text-sm font-semibold tracking-tight text-white/40">Пусто</h3>
                  </motion.div>
                ) : (
                  filteredPrompts.map((p) => (
                    <PromptCard 
                      key={p.id}
                      prompt={p}
                      favorites={favorites}
                      toggleFavorite={toggleFavorite}
                      handleCopy={handleCopy}
                      setSelectedPrompt={setSelectedPrompt}
                      copiedId={copiedId}
                    />
                  ))
                )}
              </AnimatePresence>
            </motion.div>
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

      {/* DETAIL MODAL */}
      <AnimatePresence>
        {selectedPrompt && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              className="absolute inset-0 bg-black/90 backdrop-blur-md touch-none"
              onClick={() => setSelectedPrompt(null)} 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
            />
            <motion.div 
              initial={{ scale: 0.97, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.97, opacity: 0 }} 
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} 
              className="relative bg-[#111] w-full max-w-3xl rounded-[2.5rem] overflow-hidden z-10 shadow-2xl"
            >
              <button onClick={() => setSelectedPrompt(null)} className="absolute top-6 right-6 p-2 rounded-full bg-black/40 text-white/50 z-20"><X size={20} /></button>
              <div className="flex flex-col md:flex-row max-h-[85vh] overflow-y-auto no-scrollbar">
                <div className="relative w-full h-[70vh] flex items-start justify-center">
                  <img
                    src={selectedPrompt.image?.src}
                    className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-40"
                  />
                  <img
                    src={selectedPrompt.image?.src}
                    className="relative z-10 max-h-full w-auto object-contain"
                  />
                </div>
                
                {/* Замени весь блок с описанием и кнопками на этот код: */}
                <div className="md:w-1/2 p-5 md:p-10 space-y-3 flex flex-col justify-end">
                  
                  {/* ГРИД: Слева текст, Справа кнопки */}
                  <div className="flex gap-2 h-32">
                    
                    {/* 1. ТЕКСТ (Слева) */}
                    <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-3 overflow-y-auto">
                      <p className="text-[13px] leading-relaxed text-white/90 whitespace-pre-wrap select-all font-medium">
                        {selectedPrompt.prompt}
                      </p>
                    </div>

                    {/* 2. КНОПКИ (Справа, колонка) */}
                    <div className="flex flex-col gap-2 w-14 flex-shrink-0">
                      
                      {/* Кнопка ЛАЙК (Верхняя) */}
                      <button
                        onClick={(e) => toggleFavorite(e, selectedPrompt.id)}
                        className="flex-1 flex items-center justify-center bg-white/5 border border-white/10 rounded-2xl active:scale-90 transition-all hover:bg-white/10"
                      >
                        <Heart 
                          size={20} 
                          className={favorites.includes(selectedPrompt.id) ? "text-red-500 fill-red-500" : "text-white/40"} 
                        />
                      </button>

                      {/* Кнопка КОПИРОВАТЬ (Нижняя) */}
                      <button
                        onClick={() => handleCopy(selectedPrompt.id, selectedPrompt.prompt, selectedPrompt.price)}
                        className={`flex-1 flex items-center justify-center border rounded-2xl active:scale-90 transition-all ${
                          copiedId === selectedPrompt.id 
                            ? 'bg-white border-white text-black' 
                            : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10'
                        }`}
                      >
                         {copiedId === selectedPrompt.id ? <Check size={20} /> : <Copy size={20} />}
                      </button>

                    </div>
                  </div>

                  {/* 3. Кнопка СГЕНЕРИРОВАТЬ (Снизу) */}
                  <button
                    onClick={() => {
                      setIsGenerateOpen(true);
                      setGeneratePrompt(selectedPrompt.prompt);
                    }}
                    className="w-full py-3.5 rounded-2xl font-semibold text-[14px] bg-white text-black active:scale-[0.98] shadow-lg shadow-white/10"
                  >
                    Сгенерировать
                  </button>
                  
                  {/* Старую длинную кнопку "Скопировать" я удалил, так как она теперь справа в маленьком квадрате */}

                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Генерация изображений */}
      {isGenerateOpen && (
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111] rounded-3xl p-6 w-full max-w-md space-y-4 border border-white/10">
            <h2 className="text-lg font-semibold tracking-tight">
              Генерация изображения
            </h2>

            <textarea
              value={generatePrompt}
              onChange={(e) => setGeneratePrompt(e.target.value)}
              placeholder="Опиши изображение..."
              className="w-full h-32 bg-black/40 rounded-xl p-3 text-sm text-white placeholder:text-white/30 outline-none border border-white/10 resize-none"
            />

            {/* Добавляем переключатель выбора модели */}
            <div className="flex gap-4 mb-4 p-4 bg-gray-800 rounded-lg">
              <label className="flex items-center gap-2 cursor-pointer text-white">
                <input
                  type="radio"
                  name="model"
                  checked={model === "openai"}
                  onChange={() => setModel("openai")}
                  className="accent-blue-500"
                />
                <span>OpenAI (DALL-E 2)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-white">
                <input
                  type="radio"
                  name="model"
                  checked={model === "google"}
                  onChange={() => setModel("google")}
                  className="accent-green-500"
                />
                <span>Google (Imagen 3)</span>
              </label>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-3 rounded-xl bg-white text-black font-semibold active:scale-95 transition disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Генерация...
                </>
              ) : (
                "Сгенерировать"
              )}
            </button>

            {imageUrl && (
              <div className="mt-4 space-y-2">
                <img 
                  src={imageUrl} 
                  alt="Generated"
                  className="rounded-xl w-full"
                />
                <a
                  href={imageUrl}
                  download="generated-image.png"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center py-2 rounded-xl bg-white text-black font-semibold active:scale-95 transition"
                >
                  Скачать изображение
                </a>
              </div>
            )}

            <button
              onClick={() => {
                setIsGenerateOpen(false);
                setGeneratePrompt("");
                setImageUrl(null);
              }}
              className="w-full py-2 text-sm text-white/40"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}