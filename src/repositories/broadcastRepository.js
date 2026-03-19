/**
 * Broadcast repository — запланированные рассылки.
 */
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const DATA_DIR = process.env.VERCEL ? '/tmp' : path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'broadcasts.json');

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
  fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2));
}

/**
 * Создать рассылку.
 * @param {object} bc - { text, segment, scheduledAt? (ISO), createdBy }
 */
export function create(bc) {
  const all = readAll();
  const item = {
    id: randomUUID(),
    text: bc.text,
    segment: bc.segment || 'all',
    scheduledAt: bc.scheduledAt || new Date().toISOString(),
    createdBy: bc.createdBy,
    status: 'pending', // pending | sent | failed
    sentCount: 0,
    createdAt: new Date().toISOString(),
  };
  all.push(item);
  writeAll(all);
  return item;
}

export function findById(id) {
  return readAll().find((b) => b.id === id) || null;
}

export function findPending() {
  const now = new Date().toISOString();
  return readAll().filter((b) => b.status === 'pending' && b.scheduledAt <= now);
}

export function findAll() {
  return readAll();
}

export function updateStatus(id, status, sentCount) {
  const all = readAll();
  const idx = all.findIndex((b) => b.id === id);
  if (idx >= 0) {
    all[idx].status = status;
    if (sentCount !== undefined) all[idx].sentCount = sentCount;
    all[idx].sentAt = new Date().toISOString();
    writeAll(all);
  }
}
