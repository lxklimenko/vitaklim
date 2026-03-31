import 'server-only';
import { createClient } from '@/app/lib/supabase-server';
import type { Prompt } from '../types/prompt';

export async function getPrompts(): Promise<Prompt[]> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('prompts')
      .select('*')
      .order('id', { ascending: false });

    if (error) {
      console.error('Ошибка загрузки промптов из БД:', error);
      return [];
    }

    return (data || []).map((p: any) => ({
      id: p.id,
      title: p.title,
      tool: p.tool,
      category: p.category,
      price: p.price ?? 0,
      prompt: p.prompt_text,
      description: p.description,
      bestFor: p.best_for,
      image: p.image_url ? {
        src: p.image_url,
        width: p.image_width ?? 1080,
        height: p.image_height ?? 1080,
        aspect: p.aspect_ratio ?? '1:1',
      } : undefined,
    }));
  } catch (error) {
    console.error('Ошибка загрузки промптов:', error);
    return [];
  }
}