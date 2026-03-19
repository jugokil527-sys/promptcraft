/**
 * Project repository — file-based JSON storage.
 *
 * This layer abstracts persistence. Later you can swap this for Prisma/Postgres
 * by implementing the same interface (findById, findByUser, save, remove).
 */
import fs from 'fs';
import path from 'path';

// On Vercel the filesystem is read-only; /tmp is the only writable directory.
// Locally (and on VPS) use data/ next to the project root.
const DATA_DIR = process.env.VERCEL
  ? '/tmp'
  : path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'projects.json');

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

function readAll() {
  ensureStorage();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeAll(items) {
  ensureStorage();
  fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2));
}

export function findById(id) {
  return readAll().find((p) => p.id === id) || null;
}

export function findByUser(userId) {
  return readAll().filter((p) => p.userId === userId);
}

export function save(project) {
  const all = readAll();
  const idx = all.findIndex((p) => p.id === project.id);
  if (idx >= 0) all[idx] = project;
  else all.push(project);
  writeAll(all);
  return project;
}

export function remove(id) {
  const all = readAll();
  const filtered = all.filter((p) => p.id !== id);
  if (filtered.length === all.length) return false;
  writeAll(filtered);
  return true;
}
