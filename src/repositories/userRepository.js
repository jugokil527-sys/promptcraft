/**
 * User repository — хранит данные пользователей бота.
 * Тот же паттерн что projectRepository.js — JSON-файл.
 *
 * Поля пользователя:
 *   id        — Telegram user id (строка)
 *   username  — @username (может отсутствовать)
 *   firstName
 *   joinedAt  — ISO дата первого /start
 *   lastActive — ISO дата последнего действия
 *   tags      — string[] (для сегментации)
 *   onboarded — boolean
 */
import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.VERCEL ? '/tmp' : path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'users.json');

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

export function findById(id) {
  return readAll().find((u) => u.id === String(id)) || null;
}

export function findAll() {
  return readAll();
}

export function findByTag(tag) {
  return readAll().filter((u) => u.tags?.includes(tag));
}

/** Пользователи активные за последние N дней */
export function findActive(days = 7) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return readAll().filter((u) => new Date(u.lastActive).getTime() >= cutoff);
}

export function findInactive(days = 7) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return readAll().filter((u) => new Date(u.lastActive).getTime() < cutoff);
}

export function upsert(user) {
  const all = readAll();
  const idx = all.findIndex((u) => u.id === user.id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...user };
  } else {
    all.push(user);
  }
  writeAll(all);
  return idx >= 0 ? all[idx] : user;
}

export function addTag(id, tag) {
  const all = readAll();
  const idx = all.findIndex((u) => u.id === String(id));
  if (idx < 0) return;
  const tags = new Set(all[idx].tags || []);
  tags.add(tag);
  all[idx].tags = [...tags];
  writeAll(all);
}

export function count() {
  return readAll().length;
}
