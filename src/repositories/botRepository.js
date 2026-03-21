/**
 * Bot repository — хранит созданные пользователями боты.
 * Каждый бот: токен, сценарий, userId, статус.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = process.env.VERCEL ? '/tmp' : path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'bots.json');

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

export function create({ token, scenario, userId }) {
  const all = readAll();
  const id = crypto.randomBytes(8).toString('hex');
  const webhookSecret = crypto.createHash('sha256').update(token).digest('hex').slice(0, 16);
  const bot = {
    id,
    token,
    webhookSecret,
    scenario,
    userId: String(userId),
    createdAt: new Date().toISOString(),
    status: 'active',
  };
  all.push(bot);
  writeAll(all);
  return bot;
}

export function findBySecret(webhookSecret) {
  return readAll().find(b => b.webhookSecret === webhookSecret) || null;
}

export function findByUserId(userId) {
  return readAll().filter(b => b.userId === String(userId));
}

export function findById(id) {
  return readAll().find(b => b.id === id) || null;
}

export function remove(id) {
  const all = readAll().filter(b => b.id !== id);
  writeAll(all);
}
