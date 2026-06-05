import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BUILTIN_TEMPLATES } from '@shared/template';

export interface SavedTemplate {
  id: string;
  name: string;
  pattern: string;
  subfolders: string[];
  builtin?: boolean;
}

const BUILTINS: SavedTemplate[] = BUILTIN_TEMPLATES.map((t) => ({ ...t, builtin: true }));

interface TemplatesState {
  /** User-created templates (built-ins are merged in via `allTemplates`). */
  userTemplates: SavedTemplate[];
  selectedId: string;
  /** Last-entered project field values, persisted for convenience. */
  fields: Record<string, string>;
  setSelected: (id: string) => void;
  setField: (key: string, value: string) => void;
  upsert: (template: SavedTemplate) => void;
  remove: (id: string) => void;
}

export const useTemplates = create<TemplatesState>()(
  persist(
    (set) => ({
      userTemplates: [],
      selectedId: BUILTINS[0]?.id ?? '',
      fields: {},
      setSelected: (id) => set({ selectedId: id }),
      setField: (key, value) => set((s) => ({ fields: { ...s.fields, [key]: value } })),
      upsert: (template) =>
        set((s) => {
          const exists = s.userTemplates.some((t) => t.id === template.id);
          return {
            userTemplates: exists
              ? s.userTemplates.map((t) => (t.id === template.id ? template : t))
              : [...s.userTemplates, template],
            selectedId: template.id,
          };
        }),
      remove: (id) =>
        set((s) => ({
          userTemplates: s.userTemplates.filter((t) => t.id !== id),
          selectedId: s.selectedId === id ? (BUILTINS[0]?.id ?? '') : s.selectedId,
        })),
    }),
    { name: 'jm-copy-templates' },
  ),
);

/** Built-ins first, then user templates. */
export function allTemplates(state: TemplatesState): SavedTemplate[] {
  return [...BUILTINS, ...state.userTemplates];
}

export function findTemplate(state: TemplatesState, id: string): SavedTemplate | undefined {
  return allTemplates(state).find((t) => t.id === id);
}
