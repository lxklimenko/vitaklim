'use client';

import {
  Home,
  Star,
  Plus,
  Clock,
  User
} from 'lucide-react';

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      {/* Blur background */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-xl border-t border-white/10"></div>

      <div className="relative h-20 px-6 flex items-center justify-between">
        
        <NavItem icon={<Home size={22} />} label="Главная" active />
        <NavItem icon={<Star size={22} />} label="Избранное" />

        {/* Center action */}
        <div className="relative -mt-8">
          <button className="w-16 h-16 rounded-2xl bg-white text-black flex items-center justify-center shadow-2xl shadow-white/30 active:scale-95 transition">
            <Plus size={28} />
          </button>
        </div>

        <NavItem icon={<Clock size={22} />} label="История" />
        <NavItem icon={<User size={22} />} label="Профиль" />

      </div>
    </nav>
  );
}

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
    <button className="flex flex-col items-center gap-1 text-xs">
      <div className={active ? 'text-white' : 'text-white/40'}>
        {icon}
      </div>
      <span className={active ? 'text-white' : 'text-white/40'}>
        {label}
      </span>
    </button>
  );
}
