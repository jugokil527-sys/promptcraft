/**
 * Agent router.
 * POST /api/agent/run — run AI agent with prompt + blocks.
 */
import { Router } from 'express';
import { runAgent } from '../services/agentService.js';
import { requireFields } from '../middleware/validate.js';

const router = Router();

const asyncWrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.post('/run', asyncWrap(async (req, res) => {
  const { prompt, blocks = [] } = req.body;
  requireFields(req.body, ['prompt']);

  const result = await runAgent({ prompt, blocks });
  res.json(result);
}));

export default router;
