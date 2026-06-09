/** Minimal typed event emitter used by the engine to notify the React bridge. */
export class Emitter<T> {
  private listeners = new Set<(payload: T) => void>();

  on(fn: (payload: T) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(payload: T): void {
    for (const fn of this.listeners) fn(payload);
  }
}
