import { create } from 'zustand';
import { COOKBOOK } from '@jm/cookbook';
import type { Recipe } from '@jm/cookbook';

// Kochbuch-Reader. Phase 1: rein gebündelter Stand (Offline). Die Live-Quelle
// (Release-Proxy, analog Patch Notes) wird in Phase 4/5 ergänzt — dann ersetzt
// `load()` die Rezepte aus `window.jmps.getCookbook()`.
interface CookbookStore {
  recipes: Recipe[];
  /** Modal offen? */
  open: boolean;
  /** Aktuell gewähltes Rezept (ID) oder null. */
  selectedId: string | null;
  openCookbook: (recipeId?: string) => void;
  closeCookbook: () => void;
  select: (recipeId: string) => void;
  findRecipe: (id: string) => Recipe | undefined;
}

export const useCookbook = create<CookbookStore>((set, get) => ({
  recipes: COOKBOOK.recipes as Recipe[],
  open: false,
  selectedId: null,
  openCookbook: (recipeId) =>
    set((s) => ({ open: true, selectedId: recipeId ?? s.selectedId ?? s.recipes[0]?.id ?? null })),
  closeCookbook: () => set({ open: false }),
  select: (recipeId) => set({ selectedId: recipeId }),
  findRecipe: (id) => get().recipes.find((r) => r.id === id),
}));
