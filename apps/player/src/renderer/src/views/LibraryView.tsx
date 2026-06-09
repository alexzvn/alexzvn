import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, cn } from '@jm/ui';
import type { MediaItem } from '@shared/types';
import { usePlayer } from '@/store/player';
import { basename, formatBytes, formatDuration } from '@/lib/format';

export function LibraryView() {
  const loading = usePlayer((s) => s.loading);
  const activePlaylistId = usePlayer((s) => s.activePlaylistId);

  return (
    <div className="h-full flex">
      <Sidebar />
      <section className="flex-1 min-w-0 flex flex-col border-r border-[var(--border)]/60">
        {loading ? (
          <div className="flex-1 grid place-items-center text-sm text-[var(--muted-foreground)]">
            Lade Bibliothek…
          </div>
        ) : activePlaylistId == null ? (
          <AllMediaList />
        ) : (
          <PlaylistQueue />
        )}
      </section>
      <PlayerPanel />
    </div>
  );
}

// ---------------------------------------------------------------- Sidebar

function Sidebar() {
  const playlists = usePlayer((s) => s.playlists.filter((p) => p.kind === 'playlist'));
  const activePlaylistId = usePlayer((s) => s.activePlaylistId);
  const selectPlaylist = usePlayer((s) => s.selectPlaylist);
  const createPlaylist = usePlayer((s) => s.createPlaylist);
  const removePlaylist = usePlayer((s) => s.removePlaylist);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const submit = async (): Promise<void> => {
    const pl = await createPlaylist(name, 'playlist');
    setName('');
    setAdding(false);
    if (pl) void selectPlaylist(pl.id);
  };

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-[var(--border)]/60 bg-[var(--card)]/30">
      <div className="px-4 pt-4 pb-2 text-[10px] uppercase tracking-[0.14em] font-extrabold text-[var(--muted-foreground)]">
        Quellen
      </div>
      <nav className="px-2 flex-1 overflow-auto scroll-thin">
        <SourceRow active={activePlaylistId == null} onClick={() => selectPlaylist(null)} label="Alle Medien" />
        {playlists.map((p) => (
          <SourceRow
            key={p.id}
            active={activePlaylistId === p.id}
            onClick={() => selectPlaylist(p.id)}
            label={p.name}
            onRemove={() => removePlaylist(p.id)}
          />
        ))}
      </nav>

      <div className="p-2 border-t border-[var(--border)]/60">
        {adding ? (
          <div className="flex flex-col gap-2">
            <input
              autoFocus
              value={name}
              placeholder="Playlist-Name"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && name.trim()) void submit();
                if (e.key === 'Escape') setAdding(false);
              }}
              className="h-9 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-2.5 text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="primary" disabled={!name.trim()} onClick={() => void submit()}>
                Anlegen
              </Button>
              <Button size="sm" variant="ghost" uppercase={false} onClick={() => setAdding(false)}>
                Abbrechen
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="w-full" onClick={() => setAdding(true)}>
            + Playlist
          </Button>
        )}
      </div>
    </aside>
  );
}

function SourceRow({
  active,
  onClick,
  label,
  onRemove,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  onRemove?: () => void;
}) {
  return (
    <div
      className={cn(
        'group flex items-center gap-2 h-9 px-2.5 rounded-[var(--radius)] cursor-pointer text-sm font-semibold',
        active
          ? 'bg-[var(--highlight)] text-[var(--foreground)]'
          : 'text-[var(--foreground)]/80 hover:bg-[var(--highlight)]',
      )}
      onClick={onClick}
    >
      <span className="truncate flex-1">{label}</span>
      {onRemove && (
        <button
          type="button"
          title="Playlist löschen"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="opacity-0 group-hover:opacity-100 text-[var(--muted-foreground)] hover:text-[var(--destructive)]"
        >
          <XIcon />
        </button>
      )}
    </div>
  );
}

// ----------------------------------------------------------- All-media list

function AllMediaList() {
  const items = usePlayer((s) => s.items);
  const busy = usePlayer((s) => s.busy);
  const importFiles = usePlayer((s) => s.importFiles);
  const importFolders = usePlayer((s) => s.importFolders);
  const importPaths = usePlayer((s) => s.importPaths);
  const [query, setQuery] = useState('');

  const visible = useMemo(() => filterItems(items, query), [items, query]);

  const onDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    const paths = Array.from(e.dataTransfer.files)
      .map((f) => window.jmplay.pathForFile(f))
      .filter(Boolean);
    if (paths.length) void importPaths(paths);
  };

  return (
    <div
      className="flex-1 flex flex-col min-h-0"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <ListHeader title="Alle Medien" count={visible.length} query={query} onQuery={setQuery}>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void importFolders()}>
          Ordner…
        </Button>
        <Button size="sm" variant="primary" disabled={busy} onClick={() => void importFiles()}>
          Dateien…
        </Button>
      </ListHeader>

      {items.length === 0 ? (
        <EmptyImport onFolders={importFolders} onFiles={importFiles} busy={busy} />
      ) : (
        <div className="flex-1 overflow-auto scroll-thin px-3 pb-4">
          {visible.map((item) => (
            <MediaRow key={item.id} item={item} context="all" />
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------- Playlist queue

function PlaylistQueue() {
  const activePlaylistId = usePlayer((s) => s.activePlaylistId)!;
  const playlist = usePlayer((s) => s.playlists.find((p) => p.id === s.activePlaylistId));
  const queue = usePlayer((s) => s.queue);
  const play = usePlayer((s) => s.play);
  const removeQueueItem = usePlayer((s) => s.removeQueueItem);
  const reorder = usePlayer((s) => s.queue);
  const [query, setQuery] = useState('');

  const move = (index: number, dir: -1 | 1): void => {
    const ids = queue.map((q) => q.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    void window.jmplay.playlists.reorder(activePlaylistId, ids).then(() =>
      usePlayer.getState().selectPlaylist(activePlaylistId),
    );
  };

  const visible = useMemo(
    () => queue.filter((q) => matches(q.media, query)),
    [queue, query],
  );
  void reorder;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ListHeader title={playlist?.name ?? 'Playlist'} count={queue.length} query={query} onQuery={setQuery}>
        <Button
          size="sm"
          variant="primary"
          disabled={queue.length === 0}
          onClick={() => queue[0] && play(queue[0].media.id)}
        >
          ▶ Abspielen
        </Button>
      </ListHeader>

      {queue.length === 0 ? (
        <div className="flex-1 grid place-items-center text-center px-8">
          <p className="text-sm text-[var(--muted-foreground)] max-w-sm">
            Diese Playlist ist leer. Wechsle zu „Alle Medien" und füge Titel über das{' '}
            <span className="font-bold text-[var(--foreground)]">+</span> hinzu.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto scroll-thin px-3 pb-4">
          {visible.map((q, i) => (
            <MediaRow
              key={q.id}
              item={q.media}
              context="playlist"
              onRemove={() => removeQueueItem(q.id)}
              onMove={(dir) => move(i, dir)}
              first={i === 0}
              last={i === visible.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- ListHeader

function ListHeader({
  title,
  count,
  query,
  onQuery,
  children,
}: {
  title: string;
  count: number;
  query: string;
  onQuery: (q: string) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4 flex flex-wrap items-center gap-3 border-b border-[var(--border)]/60">
      <div className="min-w-0">
        <h2 className="text-lg font-extrabold tracking-tight truncate">{title}</h2>
        <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">{count} Titel</p>
      </div>
      <input
        value={query}
        placeholder="Suchen…"
        onChange={(e) => onQuery(e.target.value)}
        className="h-9 w-44 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--input)] px-3 text-sm
                   focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]"
      />
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------- MediaRow

function MediaRow({
  item,
  context,
  onRemove,
  onMove,
  first,
  last,
}: {
  item: MediaItem;
  context: 'all' | 'playlist';
  onRemove?: () => void;
  onMove?: (dir: -1 | 1) => void;
  first?: boolean;
  last?: boolean;
}) {
  const currentMediaId = usePlayer((s) => s.currentMediaId);
  const play = usePlayer((s) => s.play);
  const removeItem = usePlayer((s) => s.removeItem);
  const active = currentMediaId === item.id;

  return (
    <div
      onDoubleClick={() => play(item.id)}
      className={cn(
        'group flex items-center gap-3 px-2.5 py-2 rounded-[var(--radius)] cursor-default',
        active ? 'bg-[var(--primary)]/12' : 'hover:bg-[var(--highlight)]',
      )}
    >
      <button
        type="button"
        onClick={() => play(item.id)}
        title="Abspielen"
        className={cn(
          'grid place-items-center size-9 shrink-0 rounded-[var(--radius)] border',
          active
            ? 'border-[var(--primary)]/50 text-[var(--primary)]'
            : 'border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--card)]',
        )}
      >
        <PlayIcon />
      </button>

      <Thumb item={item} />

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{item.title || item.fileName}</div>
        <div className="truncate text-[11px] text-[var(--muted-foreground)]">
          {item.artist ? `${item.artist} · ` : ''}
          {item.codec ?? '—'} · {formatBytes(item.sizeBytes)}
        </div>
      </div>

      <Badge tone={item.kind === 'video' ? 'neutral' : 'muted'}>{item.kind}</Badge>
      <span className="tabular text-xs text-[var(--muted-foreground)] w-14 text-right">
        {formatDuration(item.durationSec)}
      </span>

      <div className="flex items-center gap-1 w-[120px] justify-end">
        {context === 'all' && <AddToPlaylist mediaId={item.id} />}
        {context === 'playlist' && onMove && (
          <>
            <IconBtn title="Hoch" disabled={first} onClick={() => onMove(-1)}>
              <ArrowIcon up />
            </IconBtn>
            <IconBtn title="Runter" disabled={last} onClick={() => onMove(1)}>
              <ArrowIcon />
            </IconBtn>
          </>
        )}
        <IconBtn title="Im Ordner zeigen" onClick={() => window.jmplay.shell.reveal(item.path)}>
          <FolderIcon />
        </IconBtn>
        {context === 'all' ? (
          <IconBtn title="Aus Bibliothek entfernen" onClick={() => removeItem(item.id)}>
            <XIcon />
          </IconBtn>
        ) : (
          onRemove && (
            <IconBtn title="Aus Playlist entfernen" onClick={onRemove}>
              <XIcon />
            </IconBtn>
          )
        )}
      </div>
    </div>
  );
}

function AddToPlaylist({ mediaId }: { mediaId: number }) {
  const playlists = usePlayer((s) => s.playlists.filter((p) => p.kind === 'playlist'));
  const addToPlaylist = usePlayer((s) => s.addToPlaylist);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <IconBtn title="Zu Playlist hinzufügen" onClick={() => setOpen((v) => !v)}>
        <PlusIcon />
      </IconBtn>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-48 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card)] shadow-xl py-1">
            {playlists.length === 0 ? (
              <div className="px-3 py-2 text-xs text-[var(--muted-foreground)]">
                Erst eine Playlist anlegen.
              </div>
            ) : (
              playlists.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    void addToPlaylist(p.id, [mediaId]);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--highlight)] truncate"
                >
                  {p.name}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Thumb

function Thumb({ item }: { item: MediaItem }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (item.kind !== 'video') return;
    void window.jmplay.library.thumb(item.id).then((p) => {
      if (alive && p) setSrc(window.jmplay.mediaUrl(p));
    });
    return () => {
      alive = false;
    };
  }, [item.id, item.kind]);

  return (
    <div className="size-9 shrink-0 rounded-[var(--radius)] overflow-hidden bg-[var(--muted)] grid place-items-center">
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <span className="text-[var(--muted-foreground)]">
          {item.kind === 'video' ? <FilmIcon /> : <NoteIcon />}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- PlayerPanel

function PlayerPanel() {
  const items = usePlayer((s) => s.items);
  const currentMediaId = usePlayer((s) => s.currentMediaId);
  const playNext = usePlayer((s) => s.playNext);
  const playPrev = usePlayer((s) => s.playPrev);
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);

  const item = useMemo(() => items.find((m) => m.id === currentMediaId) ?? null, [items, currentMediaId]);
  const src = item ? window.jmplay.mediaUrl(item.path) : '';

  return (
    <aside className="w-[400px] shrink-0 flex flex-col bg-[var(--card)]/30">
      <div className="aspect-video bg-black grid place-items-center overflow-hidden">
        {!item ? (
          <span className="text-xs text-[var(--muted-foreground)]">Kein Titel gewählt</span>
        ) : item.kind === 'video' ? (
          <video
            key={item.id}
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={src}
            controls
            autoPlay
            onEnded={() => playNext()}
            className="size-full"
          />
        ) : (
          <div className="size-full grid place-items-center text-[var(--muted-foreground)]">
            <NoteIcon large />
            <audio
              key={item.id}
              ref={mediaRef as React.RefObject<HTMLAudioElement>}
              src={src}
              controls
              autoPlay
              onEnded={() => playNext()}
              className="absolute bottom-0 left-0 right-0 w-full"
            />
          </div>
        )}
      </div>

      <div className="p-4 border-t border-[var(--border)]/60">
        <div className="text-sm font-extrabold truncate">{item ? item.title || item.fileName : '—'}</div>
        <div className="text-[11px] text-[var(--muted-foreground)] truncate mt-0.5">
          {item ? `${basename(item.path)} · ${formatDuration(item.durationSec)}` : 'Doppelklick auf einen Titel zum Abspielen'}
        </div>
        <div className="flex items-center gap-2 mt-4">
          <Button size="sm" variant="outline" disabled={!item} onClick={() => playPrev()}>
            ◀ Zurück
          </Button>
          <Button size="sm" variant="outline" disabled={!item} onClick={() => playNext()}>
            Weiter ▶
          </Button>
        </div>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------- helpers + icons

function filterItems(items: MediaItem[], query: string): MediaItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((m) => matches(m, q));
}
function matches(m: MediaItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    m.fileName.toLowerCase().includes(q) ||
    (m.title ?? '').toLowerCase().includes(q) ||
    (m.artist ?? '').toLowerCase().includes(q)
  );
}

function EmptyImport({
  onFolders,
  onFiles,
  busy,
}: {
  onFolders: () => void;
  onFiles: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex-1 grid place-items-center px-8">
      <div className="text-center max-w-sm">
        <div className="mx-auto mb-4 grid place-items-center size-14 rounded-[var(--radius-lg)] border border-[var(--border)] text-[var(--muted-foreground)]">
          <NoteIcon large />
        </div>
        <h3 className="text-base font-extrabold">Bibliothek ist leer</h3>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Ziehe Dateien hierher oder importiere einen Ordner mit Musik/Videos.
        </p>
        <div className="flex items-center justify-center gap-2 mt-5">
          <Button size="sm" variant="outline" disabled={busy} onClick={onFolders}>
            Ordner…
          </Button>
          <Button size="sm" variant="primary" disabled={busy} onClick={onFiles}>
            Dateien…
          </Button>
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="grid place-items-center size-8 rounded-[var(--radius)] text-[var(--muted-foreground)]
                 hover:bg-[var(--card)] hover:text-[var(--foreground)] disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
function FolderIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}
function ArrowIcon({ up }: { up?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={up ? undefined : { transform: 'rotate(180deg)' }}>
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  );
}
function FilmIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 4v16M17 4v16M3 9h4M17 9h4M3 15h4M17 15h4" />
    </svg>
  );
}
function NoteIcon({ large }: { large?: boolean }) {
  const s = large ? 22 : 16;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}
