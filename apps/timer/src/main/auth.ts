import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { app } from 'electron';

export interface AuthConfig {
  enabled: boolean;
  token: string;
}

let cfg: AuthConfig = { enabled: false, token: '' };
const listeners = new Set<(c: AuthConfig) => void>();

function authPath(): string {
  return path.join(app.getPath('userData'), 'auth.json');
}

function generateToken(): string {
  // 16 random bytes → 32-char hex (128 bits of entropy)
  return crypto.randomBytes(16).toString('hex');
}

export function loadAuth(): void {
  try {
    const raw = fs.readFileSync(authPath(), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<AuthConfig>;
    cfg = {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : false,
      token:
        typeof parsed.token === 'string' && parsed.token.length > 0
          ? parsed.token
          : generateToken(),
    };
  } catch {
    cfg = { enabled: false, token: generateToken() };
  }
  persist();
}

function persist(): void {
  try {
    fs.writeFileSync(authPath(), JSON.stringify(cfg, null, 2), 'utf-8');
  } catch {
    // disk errors must not crash the app
  }
}

function notify(): void {
  for (const l of listeners) l(cfg);
}

export function getAuth(): AuthConfig {
  return cfg;
}

export function setAuthEnabled(enabled: boolean): AuthConfig {
  cfg = { ...cfg, enabled };
  persist();
  notify();
  return cfg;
}

export function regenerateToken(): AuthConfig {
  cfg = { ...cfg, token: generateToken() };
  persist();
  notify();
  return cfg;
}

export function isTokenValid(supplied: string | undefined | null): boolean {
  if (!cfg.enabled) return true;
  if (!supplied) return false;
  if (supplied.length !== cfg.token.length) return false;
  // constant-time compare to avoid timing leaks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(supplied),
      Buffer.from(cfg.token),
    );
  } catch {
    return false;
  }
}

export function onAuthChange(fn: (c: AuthConfig) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
