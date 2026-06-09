import { useEffect, useState } from 'react';
import type { AiStatus } from '@shared/types';

let cache: AiStatus | null = null;
let inflight: Promise<AiStatus> | null = null;

/** Availability of the local AI segmentation model (null until known). */
export function useAiStatus(): AiStatus | null {
  const [status, setStatus] = useState<AiStatus | null>(cache);

  useEffect(() => {
    if (cache) {
      setStatus(cache);
      return;
    }
    if (!window.jmg?.ai) return;
    inflight ??= window.jmg.ai.status().then((s) => {
      cache = s;
      return s;
    });
    let alive = true;
    inflight.then((s) => alive && setStatus(s)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return status;
}
