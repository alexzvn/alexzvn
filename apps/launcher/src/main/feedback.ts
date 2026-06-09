import { app } from 'electron';
import { release } from 'node:os';
import type { ActionResult, FeedbackInput } from '@shared/types';
import { resolveProxy, resolveProxyKey, resolveToken } from './settings';
import { getTools } from './manifest';

const FALLBACK_REPO = 'AlexmachtCode/alexzvn';

/** Alle Tools teilen sich dasselbe Repo; sonst Fallback. */
function repo(): string {
  return getTools()[0]?.repo || FALLBACK_REPO;
}

/** Kontextzeile fürs Issue (Version + OS) — hilft beim Reproduzieren. */
function contextLine(): string {
  return `Launcher ${app.getVersion()} · ${process.platform} ${release()}`;
}

/**
 * Meldet Bug/Wunsch als GitHub-Issue. Primär über den Release-Proxy (Client
 * bleibt tokenlos, serverseitiges Token legt das Issue an); fällt auf ein lokal
 * konfiguriertes GitHub-Token zurück (braucht dann issues:write).
 */
export async function submitFeedback(input: FeedbackInput): Promise<ActionResult> {
  const title = input.title?.trim();
  const description = input.description?.trim();
  if (!title || !description) {
    return { ok: false, message: 'Bitte Titel und Beschreibung ausfüllen.' };
  }

  // 1) Über den Proxy (bevorzugt, tokenlos).
  const proxy = resolveProxy();
  const key = resolveProxyKey();
  if (proxy && key) {
    try {
      const res = await fetch(`${proxy.replace(/\/$/, '')}/feedback`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-Proxy-Key': key },
        body: JSON.stringify({ type: input.type, title, description, context: contextLine() }),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { url?: string };
        return { ok: true, message: data.url ? `Danke! Gemeldet: ${data.url}` : 'Danke, gemeldet!' };
      }
      // Proxy erreichbar, aber Fehler → Token-Fallback versuchen.
    } catch {
      // Netzwerkfehler → Token-Fallback versuchen.
    }
  }

  // 2) Direktes GitHub-Token (Fallback; braucht issues:write).
  const token = resolveToken();
  if (token) {
    const isBug = input.type === 'bug';
    const body =
      description +
      '\n\n---\n_Aus dem JM Production Suite Launcher gemeldet_' +
      `\n\n\`\`\`\n${contextLine()}\n\`\`\``;
    try {
      const res = await fetch(`https://api.github.com/repos/${repo()}/issues`, {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          title: `[${isBug ? 'Bug' : 'Wunsch'}] ${title}`,
          body,
          labels: [isBug ? 'bug' : 'enhancement', 'from-launcher'],
        }),
      });
      if (res.ok) {
        const issue = (await res.json()) as { html_url?: string };
        return {
          ok: true,
          message: issue.html_url ? `Danke! Gemeldet: ${issue.html_url}` : 'Danke, gemeldet!',
        };
      }
      return { ok: false, message: `GitHub-Fehler ${res.status} (Token braucht issues:write).` };
    } catch (e) {
      return { ok: false, message: `Senden fehlgeschlagen: ${String((e as Error).message || e)}` };
    }
  }

  return {
    ok: false,
    message: 'Kein Feedback-Kanal verfügbar — Proxy/Token in den Einstellungen prüfen.',
  };
}
