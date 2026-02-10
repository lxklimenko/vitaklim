import 'server-only';
// app/lib/getPrompts.ts
import prompts from '@/app/data/prompts.json';

import type { Prompt } from '../types/prompt';

export function getPrompts(): Prompt[] {
  try {
    if (!Array.isArray(prompts)) {
      console.error('prompts.json не является массивом');
      return [];
    }

    return prompts as Prompt[];
  } catch (error) {
    console.error('Ошибка загрузки prompts:', error);
    return [];
  }
}
