import { useEffect, useState } from 'react';
import type { PrompterState } from '@shared/types';
import { PrompterScroller } from '@/components/PrompterScroller';
import { usePrompterHotkeys } from '@/lib/useHotkeys';

/** Schlankes Vollbild-Ausgabefenster (#output). Eigene State-Subscription, keine Operator-UI. */
export function PrompterOutputView(): React.JSX.Element {
  const [state, setState] = useState<PrompterState | null>(null);
  usePrompterHotkeys();

  useEffect(() => {
    void window.jmprompt.getState().then(setState);
    return window.jmprompt.onState(setState);
  }, []);

  return (
    <div className="fixed inset-0 bg-black" style={{ cursor: 'none' }}>
      {state && <PrompterScroller state={state} onEnd={() => void window.jmprompt.transport.pause()} />}
    </div>
  );
}
