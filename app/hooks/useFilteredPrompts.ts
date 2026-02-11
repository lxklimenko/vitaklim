import { useMemo, useDeferredValue } from 'react';
import { Prompt } from '../types/prompt';

interface UseFilteredPromptsProps {
  prompts: Prompt[];
  activeCategory: string;
  searchQuery: string;
}

export function useFilteredPrompts({
  prompts,
  activeCategory,
  searchQuery,
}: UseFilteredPromptsProps) {
  const deferredSearch = useDeferredValue(searchQuery);

  const filteredPrompts = useMemo(() => {
    let result = prompts;

    // Фильтрация по категории
    if (activeCategory !== 'Все') {
      result = result.filter(
        (p) => p.category === activeCategory
      );
    }

    // Поиск
    if (deferredSearch.trim()) {
      const q = deferredSearch.toLowerCase();

      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q)
      );
    }

    return result;
  }, [prompts, activeCategory, deferredSearch]);

  return filteredPrompts;
}
