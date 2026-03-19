/**
 * Projects router.
 * All handlers are thin — they delegate to projectService.
 * Async errors are caught by asyncWrap and forwarded to errorHandler middleware.
 */
import { Router } from 'express';
import * as projectService from '../services/projectService.js';
import { requireFields } from '../middleware/validate.js';

const router = Router();

// Wrap async handlers so Express catches thrown errors
const asyncWrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// POST /api/projects — create or update a project
router.post('/', asyncWrap(async (req, res) => {
  const { id, userId, name, blocks } = req.body;
  requireFields(req.body, ['userId']);

  const project = projectService.createOrUpdateProject({ id, userId, name, blocks });
  res.status(id ? 200 : 201).json(project);
}));

// GET /api/projects/:id — get a single project
router.get('/:id', asyncWrap(async (req, res) => {
  const project = projectService.getProject(req.params.id);
  res.json(project);
}));

// DELETE /api/projects/:id — delete a project (requires userId in body for auth)
router.delete('/:id', asyncWrap(async (req, res) => {
  requireFields(req.body, ['userId']);
  projectService.deleteProject(req.params.id, req.body.userId);
  res.json({ ok: true });
}));

// GET /api/users/:userId/projects — list all projects for a user
router.get('/users/:userId', asyncWrap(async (req, res) => {
  const projects = projectService.getUserProjects(req.params.userId);
  res.json(projects);
}));

export default router;
