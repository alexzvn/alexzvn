import { Emitter } from '../emitter';

export interface Command {
  label: string;
  /** Re-apply the change (also used as the initial "do" when pushed via run). */
  redo(): void;
  /** Revert the change. */
  undo(): void;
}

/**
 * Undo/redo stacks holding Commands. The engine convention: a tool performs its
 * change directly, then pushes a Command that knows how to undo/redo it. The
 * history is the source of truth; the React store mirrors `canUndo/canRedo` and
 * the labels via the `changed` emitter.
 */
export class History {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  readonly changed = new Emitter<void>();

  constructor(private cap = 50) {}

  /** Register an already-performed command. */
  push(command: Command): void {
    this.undoStack.push(command);
    if (this.undoStack.length > this.cap) this.undoStack.shift();
    this.redoStack = [];
    this.changed.emit();
  }

  /** Run a command's redo() now and register it. */
  run(command: Command): void {
    command.redo();
    this.push(command);
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): void {
    const cmd = this.undoStack.pop();
    if (!cmd) return;
    cmd.undo();
    this.redoStack.push(cmd);
    this.changed.emit();
  }

  redo(): void {
    const cmd = this.redoStack.pop();
    if (!cmd) return;
    cmd.redo();
    this.undoStack.push(cmd);
    this.changed.emit();
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.changed.emit();
  }
}
