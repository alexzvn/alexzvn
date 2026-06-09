import type { Role } from '@shared/roles';

export interface UserRow {
  id: number;
  username: string;
  role: Role;
  created_at: number;
}
