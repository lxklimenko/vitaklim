'use client';

import React from 'react';
import { 
  Home as HomeIcon, 
  Star, 
  User as UserIcon, 
  Clock,
  Heart
} from 'lucide-react';

export function SkeletonCard() {
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

export function NavItem({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) {
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