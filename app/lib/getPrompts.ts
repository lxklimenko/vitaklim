import 'server-only';
// app/lib/getPrompts.ts
import prompts from '@/app/data/prompts.json';

import type { Prompt } from '../types/prompt';

export function getPrompts(): Prompt[] {
  return prompts as Prompt[];
}
