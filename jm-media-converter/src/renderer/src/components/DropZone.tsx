import { useState } from 'react';
import { cn } from '@/lib/cn';
import { Button } from './ui/Button';

interface Props {
  hint: string;
  onFiles: (paths: string[]) => void;
  onPick: () => void;
}

export function DropZone({ hint, onFiles, onPick }: Props) {
  const [over, setOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const paths: string[] = [];
        for (const file of Array.from(e.dataTransfer.files)) {
          const p = window.jmc.pathForFile(file);
          if (p) paths.push(p);
        }
        if (paths.length) onFiles(paths);
      }}
      className={cn(
        'rounded-[var(--radius-xl)] border-2 border-dashed px-8 py-10 text-center transition-colors',
        over
          ? 'border-[var(--primary)] bg-[var(--highlight)]'
          : 'border-[var(--border)] bg-[var(--card)]/30',
      )}
    >
      <p className="text-sm text-[var(--muted-foreground)]">{hint}</p>
      <div className="mt-4 flex justify-center">
        <Button variant="outline" onClick={onPick}>
          Dateien wählen
        </Button>
      </div>
    </div>
  );
}
