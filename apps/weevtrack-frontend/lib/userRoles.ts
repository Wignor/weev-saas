import fs from 'fs';
import path from 'path';

const ROLES_FILE = path.join(process.cwd(), 'data', 'user_roles.json');

export function readRoles(): Record<string, string> {
  try {
    if (!fs.existsSync(ROLES_FILE)) return {};
    return JSON.parse(fs.readFileSync(ROLES_FILE, 'utf-8'));
  } catch { return {}; }
}

export function saveRole(userId: string | number, role: string) {
  const roles = readRoles();
  roles[String(userId)] = role;
  const dir = path.dirname(ROLES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(ROLES_FILE, JSON.stringify(roles, null, 2));
}

export function deleteRole(userId: string | number) {
  const roles = readRoles();
  delete roles[String(userId)];
  fs.writeFileSync(ROLES_FILE, JSON.stringify(roles, null, 2));
}
