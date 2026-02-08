'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Star,
  Plus,
  Clock,
  User
} from 'lucide-react';

// Описываем, какие функции принимает меню
interface BottomNavProps {
  onOpenGenerate: () => void;
  onOpenProfile: () => void;
}

export default function BottomNav({ onOpenGenerate, onOpenProfile }: BottomNavProps) {
  const pathname = usePathname();
  
  // Проверяем, где мы находимся
  const isHome = pathname === '/';
  const isHistory = pathname === '/history';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden pb-safe">
      {/* Blur background */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl border-t border-white/10"></div>

      <div className="relative h-20 px-6 flex items-center justify-between">
        
        {/* 1. ГЛАВНАЯ (Ссылка) */}
        <Link href="/" className="min-w-[50px] flex justify-center">
           <NavItem icon={<Home size={22} />} label="Главная" active={isHome} />
        </Link>

        {/* 2. ИЗБРАННОЕ (Пока оставим ссылкой на фильтр главной или заглушкой) */}
        <div className="min-w-[50px] flex justify-center opacity-50">
           <NavItem icon={<Star size={22} />} label="Избранное" active={false} />
        </div>

        {/* 3. ЦЕНТРАЛЬНАЯ КНОПКА (Генерация) */}
        <div className="relative -mt-8">
          <button 
            onClick={onOpenGenerate}
            className="w-16 h-16 rounded-2xl bg-white text-black flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.3)] active:scale-95 transition-transform"
          >
            <Plus size={28} />
          </button>
        </div>

        {/* 4. ИСТОРИЯ (Ссылка на /history) */}
        <Link href="/history" className="min-w-[50px] flex justify-center">
           <NavItem icon={<Clock size={22} />} label="История" active={isHistory} />
        </Link>

        {/* 5. ПРОФИЛЬ (Кнопка открытия модалки) */}
        <button onClick={onOpenProfile} className="min-w-[50px] flex justify-center">
           <NavItem icon={<User size={22} />} label="Профиль" active={false} />
        </button>

      </div>
    </nav>
  );
}

// Вспомогательный компонент (теперь это div, чтобы не ломать Link)
function NavItem({
  icon,
  label,
  active = false
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1 text-xs cursor-pointer group">
      <div className={`transition-colors ${active ? 'text-white' : 'text-white/40 group-hover:text-white/70'}`}>
        {icon}
      </div>
      <span className={`transition-colors ${active ? 'text-white' : 'text-white/40 group-hover:text-white/70'}`}>
        {label}
      </span>
    </div>
  );
}