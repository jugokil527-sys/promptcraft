/**
 * Analytics repository — хранит события для аналитики.
 * События: start, template_start, template_complete, button_click, message, broadcast_send
 */
import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.VERCEL ? '/tmp' : path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'analytics.json');
const MAX_ENTRIES = 50_000;

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
  const trimmed = items.length > MAX_ENTRIES ? items.slice(-MAX_ENTRIES) : items;
  fs.writeFileSync(DATA_FILE, JSON.stringify(trimmed, null, 2));
}

/**
 * Записать событие.
 * @param {object} event - { userId, event, meta? }
 */
export function track(userId, event, meta = {}) {
  const all = readAll();
  all.push({
    userId: String(userId),
    event,
    meta,
    date: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
    ts: new Date().toISOString(),
  });
  writeAll(all);
}

export function getAll() {
  return readAll();
}

/** DAU по дате (default: сегодня) */
export function getDAU(date) {
  const d = date || new Date().toISOString().slice(0, 10);
  const all = readAll();
  const users = new Set(all.filter((e) => e.date === d).map((e) => e.userId));
  return users.size;
}

/** Уникальные пользователи по дням за последние N дней */
export function getDAUHistory(days = 7) {
  const all = readAll();
  const result = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    const users = new Set(all.filter((e) => e.date === d).map((e) => e.userId));
    result[d] = users.size;
  }
  return result;
}

/** Конверсия: сколько сделали event_b из тех кто сделал event_a */
export function getConversion(eventA, eventB) {
  const all = readAll();
  const didA = new Set(all.filter((e) => e.event === eventA).map((e) => e.userId));
  const didB = new Set(all.filter((e) => e.event === eventB).map((e) => e.userId));
  const converted = [...didA].filter((u) => didB.has(u)).length;
  return { total: didA.size, converted, rate: didA.size ? Math.round(converted / didA.size * 100) : 0 };
}

/** CTR по кнопкам */
export function getButtonCTR() {
  const all = readAll();
  const clicks = all.filter((e) => e.event === 'button_click');
  const counts = {};
  for (const c of clicks) {
    const key = c.meta?.button || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

/** Retention D1/D7 */
export function getRetention() {
  const all = readAll();
  const byUser = {};
  for (const e of all) {
    if (!byUser[e.userId]) byUser[e.userId] = new Set();
    byUser[e.userId].add(e.date);
  }

  const today = new Date().toISOString().slice(0, 10);
  const d1 = new Date(Date.now() - 1 * 86_400_000).toISOString().slice(0, 10);
  const d7 = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

  let joined = 0, retDay1 = 0, retDay7 = 0;
  for (const [, dates] of Object.entries(byUser)) {
    if (dates.has(today) || dates.has(d1)) joined++;
    if (dates.has(d1)) retDay1++;
    if (dates.has(d7) && (dates.has(today) || dates.has(d1))) retDay7++;
  }

  return { joined, retDay1, retDay7 };
}
