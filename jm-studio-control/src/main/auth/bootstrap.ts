import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { countUsers, createUser } from './users';

const ADMIN_USERNAME = 'admin';

export function ensureInitialAdmin(): { created: boolean; credentialsPath?: string } {
  if (countUsers() > 0) return { created: false };
  const password = crypto.randomBytes(9).toString('base64url');
  createUser({ username: ADMIN_USERNAME, password, role: 'admin' });
  const credentialsPath = path.join(
    app.getPath('userData'),
    'first-run-credentials.txt',
  );
  const body =
    `JM Studio Control — First-run admin credentials\n\n` +
    `username: ${ADMIN_USERNAME}\n` +
    `password: ${password}\n\n` +
    `Change this password after first login. Delete this file when done.\n`;
  try {
    fs.writeFileSync(credentialsPath, body, { mode: 0o600 });
  } catch {
    // disk errors must not crash the app — credentials are also logged below.
  }
  console.log(
    `[jm-studio-control] first-run admin created — username=${ADMIN_USERNAME} password=${password}`,
  );
  console.log(
    `[jm-studio-control] credentials also written to ${credentialsPath}`,
  );
  return { created: true, credentialsPath };
}
