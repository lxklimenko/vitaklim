// app/appConstants.ts

import { Model } from '../types';

export const STORAGE_URL = 'https://gmngqxwkgnuqtkwndjwx.supabase.co/storage/v1/object/public/prompts-images/';

export const CATEGORIES = ['Все', 'Fashion', 'Art', 'Product', 'Interior', 'Lifestyle'];

export const MODELS: Model[] = [
  {
    id: 'gemini-3.1-flash-image-preview',
    name: 'Nano Banano 2',
    badge: 'NEW',
    color: 'from-blue-400 to-cyan-500',
    desc: 'Быстрая генерация для простых задач',
    price: 10
  },
  {
    id: 'gemini-3-pro-image-preview',
    name: 'Nano Banana Pro',
    badge: 'PRO',
    color: 'from-yellow-300 to-yellow-500',
    desc: 'Детализация и интеллект для сложных задач',
    price: 15
  },
  {
    id: 'gemini-3-pro-image-preview-4k',
    name: 'Nano Banano Pro (4K)',
    badge: '4K',
    color: 'from-purple-500 to-pink-500',
    desc: 'Бескомпромиссный фотореализм в 4K',
    price: 20
  }
];

export const PROMPTS = [
  // ваши данные...
];