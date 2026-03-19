import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'projects.json');

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

function readAll() {
  ensureStorage();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function writeAll(items) {
  ensureStorage();
  fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2));
}

export function listProjectsByUser(userId) {
  return readAll().filter((p) => p.userId === userId);
}

export function saveProject(project) {
  const all = readAll();
  const idx = all.findIndex((p) => p.id === project.id);

  if (idx >= 0) all[idx] = project;
  else all.push(project);

  writeAll(all);
  return project;
}

export function getProjectById(id) {
  return readAll().find((p) => p.id === id);
}
