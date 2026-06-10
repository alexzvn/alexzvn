import { useEffect } from 'react';
import { OperatorView } from '@/views/OperatorView';
import { useStage } from '@/store/stage';

export function App() {
  const load = useStage((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);
  return <OperatorView />;
}
