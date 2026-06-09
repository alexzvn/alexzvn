export { openLibrary, getLibrary, closeLibrary } from './db';
export type { OpenLibraryOptions } from './db';
export { migrate, SCHEMA_VERSION } from './schema';

export type {
  MediaKind,
  PlaylistKind,
  MediaItemRow,
  PlaylistRow,
  PlaylistItemRow,
  CueRow,
  TagRow,
} from './types';
