import { useState } from 'react';
import { useQa } from '@/store/useQa';

const inp = 'rounded border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-sm text-neutral-100';

/** Operator fügt eine Wortmeldung von Hand hinzu. */
export function AddForm() {
  const { addEntry } = useQa();
  const [name, setName] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [question, setQuestion] = useState('');

  const submit = (): void => {
    if (!name.trim()) return;
    void addEntry({ name, affiliation, question });
    setName('');
    setAffiliation('');
    setQuestion('');
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-3">
      <h2 className="mb-2 text-sm font-semibold text-neutral-300">Wortmeldung hinzufügen</h2>
      <div className="grid grid-cols-2 gap-2">
        <input
          className={inp}
          value={name}
          placeholder="Name *"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <input
          className={inp}
          value={affiliation}
          placeholder="Funktion / Medium / Fraktion"
          onChange={(e) => setAffiliation(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </div>
      <input
        className={`${inp} mt-2 w-full`}
        value={question}
        placeholder="Frage (optional)"
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
      />
      <div className="mt-2 flex justify-end">
        <button
          onClick={submit}
          disabled={!name.trim()}
          className="rounded-md bg-neutral-700 px-3 py-1.5 text-sm text-neutral-100 hover:bg-neutral-600 disabled:opacity-40"
        >
          Hinzufügen
        </button>
      </div>
    </div>
  );
}
