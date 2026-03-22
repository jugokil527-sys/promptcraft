/**
 * Deploy router.
 * POST /api/deploy — деплоит бота на VPS через SSH.
 */
import { Router } from 'express';
import { deployBot } from '../services/deployService.js';

const router = Router();

router.post('/', async (req, res) => {
  const { host, password, botId, botToken, scenario } = req.body;

  if (!host || !password || !botId || !botToken || !scenario) {
    return res.status(400).json({ error: 'Не хватает параметров: host, password, botId, botToken, scenario' });
  }

  const logs = [];
  const onLog = (msg) => logs.push(msg);

  try {
    await deployBot({ host, password, botId, botToken, scenario }, onLog);
    res.json({ ok: true, logs });
  } catch (err) {
    res.status(500).json({ error: err.message, logs });
  }
});

export default router;
