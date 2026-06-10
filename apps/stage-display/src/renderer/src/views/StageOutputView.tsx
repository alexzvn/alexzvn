import { useEffect, useState } from 'react';
import type { StageState } from '@shared/types';
import { useTick } from '@/lib/format';
import { StageScreen } from '@/components/StageScreen';

/** Schlankes Vollbild-Ausgabefenster (#output). Eigene State-Subscription, keine Operator-UI. */
export function StageOutputView() {
  const [state, setState] = useState<StageState | null>(null);
  const now = useTick();

  useEffect(() => {
    void window.jmstage.getState().then(setState);
    return window.jmstage.onState(setState);
  }, []);

  return (
    <div className="fixed inset-0 bg-black" style={{ cursor: 'none' }}>
      {state && <StageScreen state={state} now={now} />}
    </div>
  );
}
