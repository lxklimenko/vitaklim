// app/appConstants.ts

import { Model } from '../types';

export const STORAGE_URL = 'https://gmngqxwkgnuqtkwndjwx.supabase.co/storage/v1/object/public/prompts-images/';

export const CATEGORIES = ['Все', 'Fashion', 'Art', 'Product', 'Interior', 'Lifestyle'];

export const MODELS: Model[] = [
  {
    id: 'gemini-3-pro-image-preview',
    name: 'Nano Banana Pro',
    badge: 'PRO',
    color: 'from-yellow-300 to-yellow-500',
    desc: 'Топовая генерация + референсы',
    price: 5
  },
  {
    id: 'gemini-2.5-flash-image',
    name: 'Gemini 2.5 Flash Image',
    badge: 'FAST',
    color: 'from-blue-400 to-cyan-500',
    desc: 'Быстро и качественно',
    price: 3
  }
];

export const PROMPTS = [
  // ваши данные...
];