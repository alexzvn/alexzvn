import { useEffect } from 'react';
import { OperatorView } from '@/views/OperatorView';
import { useTitler } from '@/store/titler';

export function App(): React.JSX.Element {
  const load = useTitler((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);
  return <OperatorView />;
}
