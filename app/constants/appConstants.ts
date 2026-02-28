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
    id: 'gemini-3.1-flash-image-preview',
    name: 'Nano Banano 2 (Gemini 3.1 Flash)',
    badge: 'NEW',
    color: 'from-blue-400 to-cyan-500',
    desc: 'Мгновенная генерация нового поколения',
    price: 1
  },
  {
    id: 'imagen-4-ultra',
    name: 'Imagen 4 Ultra',
    badge: 'ULTRA',
    color: 'from-purple-500 to-pink-500',
    desc: 'Максимальное качество + лучший фотореализм',
    price: 5
  },
  {
    id: 'dall-e-3',
    name: 'GPT Image',
    badge: 'GPT',
    color: 'from-emerald-400 to-teal-500',
    desc: 'ИИ фотошоп от OpenAI',
    price: 5
  }
];

export const PROMPTS = [
  // ваши данные...
];