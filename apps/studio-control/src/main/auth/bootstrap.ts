import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { countUsers, createUser } from './users';

// MVP test build: seed a well-known Admin/Admin account on first run so the
// reviewer can log in without hunting for a generated password. Change this
// to a random secret before production deployment.
const ADMIN_USERNAME = 'Admin';
const ADMIN_PASSWORD = 'Admin';

export function ensureInitialAdmin(): { created: boolean; credentialsPath?: string } {
  if (countUsers() > 0) return { created: false };
  createUser({ username: ADMIN_USERNAME, password: ADMIN_PASSWORD, role: 'admin' });
  const credentialsPath = path.join(
    app.getPath('userData'),
    'first-run-credentials.txt',
  );
  const body =
    `JM Studio Control — First-run admin credentials (TEST BUILD)\n\n` +
    `username: ${ADMIN_USERNAME}\n` +
    `password: ${ADMIN_PASSWORD}\n\n` +
    `⚠ WEAK CREDENTIALS — replace before production use.\n` +
    `Change this password after first login. Delete this file when done.\n`;
  try {
    fs.writeFileSync(credentialsPath, body, { mode: 0o600 });
  } catch {
    // disk errors must not crash the app
  }
  console.log(
    `[jm-studio-control] first-run admin created — username=${ADMIN_USERNAME} password=${ADMIN_PASSWORD} (TEST BUILD)`,
  );
  console.log(
    `[jm-studio-control] credentials also written to ${credentialsPath}`,
  );
  return { created: true, credentialsPath };
}
