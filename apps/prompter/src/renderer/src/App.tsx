import { useEffect } from 'react';
import { OperatorView } from '@/views/OperatorView';
import { usePrompter } from '@/store/prompter';

export function App(): React.JSX.Element {
  const load = usePrompter((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);
  return <OperatorView />;
}
