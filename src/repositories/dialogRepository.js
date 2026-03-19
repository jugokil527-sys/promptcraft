/**
 * Dialog repository — лог диалогов бота.
 * Хранит входящие сообщения и ответы бота.
 * Используется для AI автоответов и ручного фолбека.
 */
import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.VERCEL ? '/tmp' : path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'dialogs.json');
const MAX_ENTRIES = 10_000; // ограничение размера файла

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

function readAll() {
  ensureStorage();
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')); }
  catch { return []; }
}

function writeAll(items) {
  ensureStorage();
  // Обрезаем если слишком большой
  const trimmed = items.length > MAX_ENTRIES ? items.slice(-MAX_ENTRIES) : items;
  fs.writeFileSync(DATA_FILE, JSON.stringify(trimmed, null, 2));
}

/**
 * Добавить запись в лог.
 * @param {object} entry - { userId, role: 'user'|'bot', text, ts? }
 */
export function append(entry) {
  const all = readAll();
  all.push({ ...entry, ts: entry.ts || new Date().toISOString() });
  writeAll(all);
}

export function getByUser(userId, limit = 50) {
  return readAll()
    .filter((e) => e.userId === String(userId))
    .slice(-limit);
}

export function getRecent(limit = 100) {
  const all = readAll();
  return all.slice(-limit);
}

/** Необработанные сообщения (без ответа бота) */
export function getPendingFallback() {
  const all = readAll();
  const pending = [];
  let i = all.length - 1;
  while (i >= 0 && pending.length < 20) {
    if (all[i].role === 'user' && all[i].fallback === true && !all[i].answered) {
      pending.push(all[i]);
    }
    i--;
  }
  return pending.reverse();
}

export function markAnswered(ts) {
  const all = readAll();
  const idx = all.findIndex((e) => e.ts === ts);
  if (idx >= 0) {
    all[idx].answered = true;
    writeAll(all);
  }
}
