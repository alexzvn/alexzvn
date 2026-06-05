import { useEffect } from 'react';
import { connect, resolveServerUrl } from '@/sync/client';
import { useStore } from '@/store/timer';
import { OperatorView } from '@/views/Operator';
import { SpeakerView } from '@/views/Speaker';

type View = 'operator' | 'speaker' | 'remote';

function detectView(): View {
  const v = new URLSearchParams(window.location.search).get('view');
  if (v === 'speaker') return 'speaker';
  if (v === 'remote') return 'remote';
  return 'operator';
}

export function App() {
  const applyServerState = useStore((s) => s.applyServerState);
  const setConnected = useStore((s) => s.setConnected);

  useEffect(() => {
    connect(resolveServerUrl(), applyServerState, setConnected);
  }, [applyServerState, setConnected]);

  const view = detectView();
  if (view === 'speaker' || view === 'remote') return <SpeakerView />;
  return <OperatorView />;
}
