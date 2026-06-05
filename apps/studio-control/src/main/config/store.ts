import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type { ZodSchema } from 'zod';

function configDir(): string {
  const dir = path.join(app.getPath('userData'), 'config');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function fullPath(file: string): string {
  return path.join(configDir(), file);
}

export function load<T>(file: string, schema: ZodSchema<T>, fallback: T): T {
  const p = fullPath(file);
  try {
    const raw = fs.readFileSync(p, 'utf-8');
    const parsed = JSON.parse(raw);
    const result = schema.safeParse(parsed);
    if (result.success) return result.data;
    console.warn(`[jm-studio-control] config ${file} failed validation:`, result.error.flatten());
    return fallback;
  } catch {
    return fallback;
  }
}

export function save<T>(file: string, data: T, schema: ZodSchema<T>): void {
  const valid = schema.safeParse(data);
  if (!valid.success) {
    throw new Error(`config ${file} validation failed: ${valid.error.message}`);
  }
  const p = fullPath(file);
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(valid.data, null, 2), 'utf-8');
  fs.renameSync(tmp, p);
}
