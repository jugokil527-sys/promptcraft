/**
 * Express application factory.
 * Separated from index.js so it can be imported in tests without starting the server.
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import projectsRouter from './routes/projects.js';
import agentRouter from './routes/agent.js';
import botsRouter, { handleWebhook } from './routes/bots.js';
import deployRouter from './routes/deploy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);
  app.use(express.static(PUBLIC_DIR));

  // Health check — useful for Docker and monitoring
  app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

  // API routes
  app.use('/api/projects', projectsRouter);
  app.use('/api/agent', agentRouter);
  app.use('/api/bots', botsRouter);
  app.use('/api/deploy', deployRouter);
  app.post('/webhook/:secret', handleWebhook);

  // Backward-compat alias kept from MVP: GET /api/users/:userId/projects
  app.get('/api/users/:userId/projects', async (req, res, next) => {
    try {
      const { getUserProjects } = await import('./services/projectService.js');
      res.json(getUserProjects(req.params.userId));
    } catch (err) {
      next(err);
    }
  });

  // 404 fallback for API routes
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Global error handler — must be last
  app.use(errorHandler);

  return app;
}
