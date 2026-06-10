import { useEffect } from 'react';
import { OperatorView } from '@/views/OperatorView';
import { useTranscribe } from '@/store/transcribe';

export function App(): React.JSX.Element {
  const load = useTranscribe((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);
  return <OperatorView />;
}
