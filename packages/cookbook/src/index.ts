import cookbookData from '../cookbook.json';
import type { Cookbook, CookbookCategory, Recipe } from './types';

export * from './types';

/**
 * Das gebündelte Kochbuch (lokale Quelle, Offline-Fallback). Live wird dieselbe
 * `cookbook.json` vom Release-Proxy aus dem Katalog-Branch geliefert (Phase 5),
 * sodass neue Rezepte ohne Launcher-Release erscheinen — wie bei `suite.json`.
 */
export const COOKBOOK: Cookbook = cookbookData as Cookbook;

/** Alle Rezepte. */
export function listRecipes(): Recipe[] {
  return [...COOKBOOK.recipes];
}

/** Ein Rezept per ID nachschlagen (oder undefined). */
export function findRecipe(id: string): Recipe | undefined {
  return COOKBOOK.recipes.find((r) => r.id === id);
}

/** Rezepte einer Kategorie. */
export function recipesByCategory(category: CookbookCategory): Recipe[] {
  return COOKBOOK.recipes.filter((r) => r.category === category);
}
