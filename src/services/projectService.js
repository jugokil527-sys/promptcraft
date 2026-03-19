/**
 * Project service — business logic layer.
 * Knows about validation rules and orchestrates the repository.
 */
import { randomUUID } from 'crypto';
import * as repo from '../repositories/projectRepository.js';
import { AppError } from '../middleware/errorHandler.js';
import { validateBlocks } from '../middleware/validate.js';

export function createOrUpdateProject({ id, userId, name, blocks = [] }) {
  validateBlocks(blocks);

  const project = {
    id: id || randomUUID(),
    userId: String(userId),
    name: (name || 'Новый мини-апп').trim().slice(0, 120),
    blocks,
    updatedAt: new Date().toISOString(),
  };

  return repo.save(project);
}

export function getProject(id) {
  const project = repo.findById(id);
  if (!project) throw new AppError('Project not found', 404);
  return project;
}

export function getUserProjects(userId) {
  return repo.findByUser(String(userId));
}

export function deleteProject(id, userId) {
  const project = repo.findById(id);
  if (!project) throw new AppError('Project not found', 404);
  if (project.userId !== String(userId)) throw new AppError('Forbidden', 403);
  repo.remove(id);
}
