import type { ToolId } from '@/engine/types';

interface IconProps {
  size?: number;
  className?: string;
}

function svg(path: React.ReactNode, size = 18) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {path}
    </svg>
  );
}

export const TOOL_ICONS: Record<ToolId, (p: IconProps) => JSX.Element> = {
  transform: ({ size }) => svg(<><rect x="6" y="6" width="12" height="12" /><rect x="3" y="3" width="3.5" height="3.5" /><rect x="17.5" y="3" width="3.5" height="3.5" /><rect x="3" y="17.5" width="3.5" height="3.5" /><rect x="17.5" y="17.5" width="3.5" height="3.5" /></>, size),
  move: ({ size }) => svg(<><path d="M12 3v18M3 12h18" /><path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" /></>, size),
  brush: ({ size }) => svg(<><path d="M4 20s1-4 4-4 3 3 6 0c2.5-2.5-1-6-1-6L18 4l2 2-6 5" /><path d="M9.5 14.5 4 20" /></>, size),
  eraser: ({ size }) => svg(<><path d="M5 15 14 6l4 4-9 9H7z" /><path d="M5 19h14" /></>, size),
  marquee: ({ size }) => svg(<rect x="3" y="3" width="18" height="18" rx="1" strokeDasharray="3 3" />, size),
  lasso: ({ size }) => svg(<><path d="M4 11a8 5 0 1 1 9 5c-2 1-3 2-3 3" /><circle cx="10" cy="20" r="1.4" /></>, size),
  wand: ({ size }) => svg(<><path d="M15 4V2M19 8h2M17.4 5.6 19 4M5 19l9-9 1 1-9 9z" /><path d="M14 6l1 1" /></>, size),
  fill: ({ size }) => svg(<><path d="M5 11 11 5l7 7-6 6a2 2 0 0 1-3 0l-4-4a2 2 0 0 1 0-3z" /><path d="M19 15s1.5 2 1.5 3a1.5 1.5 0 0 1-3 0c0-1 1.5-3 1.5-3z" /></>, size),
  shape: ({ size }) => svg(<rect x="4" y="4" width="16" height="16" rx="1.5" />, size),
  text: ({ size }) => svg(<><path d="M5 6V4h14v2M12 4v16M9 20h6" /></>, size),
  crop: ({ size }) => svg(<><path d="M6 2v16h16M2 6h16v16" /></>, size),
  eyedropper: ({ size }) => svg(<><path d="m13 7 4 4M3 21l2-6 9-9 4 4-9 9-6 2z" /></>, size),
  hand: ({ size }) => svg(<><path d="M8 13V6a1.5 1.5 0 0 1 3 0v5M11 11V5a1.5 1.5 0 0 1 3 0v6M14 11V6a1.5 1.5 0 0 1 3 0v7c0 4-2 7-6 7s-5-2-7-5l-1-2a1.5 1.5 0 0 1 2.6-1.4L8 13" /></>, size),
  zoom: ({ size }) => svg(<><circle cx="10" cy="10" r="6" /><path d="m20 20-4-4M8 10h4M10 8v4" /></>, size),
};

export const Icon = {
  eye: ({ size = 16 }: IconProps) => svg(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="2.5" /></>, size),
  eyeOff: ({ size = 16 }: IconProps) => svg(<><path d="M4 4l16 16M9.5 9.6A2.5 2.5 0 0 0 12 14.5M6 6.5C3.5 8 2 12 2 12s3.5 7 10 7c2 0 3.7-.6 5-1.4M10 5.2A9 9 0 0 1 12 5c6.5 0 10 7 10 7a16 16 0 0 1-2.2 3" /></>, size),
  lock: ({ size = 16 }: IconProps) => svg(<><rect x="5" y="11" width="14" height="9" rx="1.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>, size),
  unlock: ({ size = 16 }: IconProps) => svg(<><rect x="5" y="11" width="14" height="9" rx="1.5" /><path d="M8 11V8a4 4 0 0 1 7-2.6" /></>, size),
  plus: ({ size = 16 }: IconProps) => svg(<path d="M12 5v14M5 12h14" />, size),
  trash: ({ size = 16 }: IconProps) => svg(<><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" /></>, size),
  duplicate: ({ size = 16 }: IconProps) => svg(<><rect x="8" y="8" width="12" height="12" rx="1.5" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></>, size),
  up: ({ size = 16 }: IconProps) => svg(<path d="m6 14 6-6 6 6" />, size),
  down: ({ size = 16 }: IconProps) => svg(<path d="m6 10 6 6 6-6" />, size),
  undo: ({ size = 16 }: IconProps) => svg(<><path d="M9 7 4 12l5 5" /><path d="M4 12h11a5 5 0 0 1 0 10h-1" /></>, size),
  redo: ({ size = 16 }: IconProps) => svg(<><path d="m15 7 5 5-5 5" /><path d="M20 12H9a5 5 0 0 0 0 10h1" /></>, size),
};
