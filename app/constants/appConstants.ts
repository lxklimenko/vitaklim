// app/appConstants.ts

import { Model } from '../types';

export const STORAGE_URL = 'https://gmngqxwkgnuqtkwndjwx.supabase.co/storage/v1/object/public/prompts-images/';

export const CATEGORIES = ['Все', 'Fashion', 'Art', 'Product', 'Interior', 'Lifestyle'];

export const MODELS: Model[] = [
  {
    id: 'imagen-4.0-ultra-generate-001',
    name: 'Imagen 4 Ultra',
    badge: 'PREMIUM',
    color: 'from-amber-400 to-orange-600',
    desc: 'Максимальное качество и фотореализм',
    price: 10
  },
  {
    id: 'nano-banana-pro-preview',
    name: 'Nano Banana Pro',
    badge: 'SMART',
    color: 'from-yellow-300 to-yellow-500',
    desc: 'Творчество и понимание сложных промптов',
    price: 5
  },
  {
    id: 'imagen-4.0-fast-generate-001',
    name: 'Imagen 4 Fast',
    badge: 'FAST',
    color: 'from-blue-400 to-cyan-500',
    desc: 'Генерация за 1-2 секунды',
    price: 2
  }
];

export const PROMPTS = [
  // ваши данные...
];