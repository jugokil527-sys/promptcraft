/**
 * Bots router.
 * POST /api/bots/create  — создать бота из сценария
 * GET  /api/bots/my      — список ботов пользователя
 * DELETE /api/bots/:id   — удалить бота
 * POST /webhook/:secret  — входящие обновления от Telegram
 */
import { Router } from 'express';
import * as botRepo from '../repositories/botRepository.js';
import { handleUpdate } from '../services/botRunnerService.js';

const router = Router();
const asyncWrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Создать бота */
router.post('/create', asyncWrap(async (req, res) => {
  const { token, scenario, userId } = req.body;
  if (!token || !scenario) return res.status(400).json({ error: 'token and scenario required' });

  // Валидируем токен через Telegram API
  const check = await fetch(`https://api.telegram.org/bot${token}/getMe`);
  const checkData = await check.json();
  if (!checkData.ok) return res.status(400).json({ error: 'Неверный токен бота. Проверь и попробуй снова.' });

  const botInfo = checkData.result;
  const bot = botRepo.create({ token, scenario, userId: userId || 'guest' });

  // Регистрируем webhook
  const webhookUrl = `${process.env.WEBHOOK_URL || process.env.PUBLIC_BASE_URL}/webhook/${bot.webhookSecret}`;
  const wh = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl }),
  });
  const whData = await wh.json();
  if (!whData.ok) return res.status(500).json({ error: 'Не удалось установить webhook: ' + whData.description });

  res.json({
    id: bot.id,
    username: botInfo.username,
    name: botInfo.first_name,
    link: `https://t.me/${botInfo.username}`,
  });
}));

/** Список ботов пользователя */
router.get('/my', asyncWrap(async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.json([]);
  const bots = botRepo.findByUserId(userId).map(b => ({
    id: b.id,
    createdAt: b.createdAt,
    status: b.status,
  }));
  res.json(bots);
}));

/** Удалить бота */
router.delete('/:id', asyncWrap(async (req, res) => {
  const bot = botRepo.findById(req.params.id);
  if (!bot) return res.status(404).json({ error: 'Not found' });

  // Снимаем webhook
  await fetch(`https://api.telegram.org/bot${bot.token}/deleteWebhook`).catch(() => {});
  botRepo.remove(req.params.id);
  res.json({ ok: true });
}));

export default router;

/** Обработчик webhook — монтируется напрямую в app.js на /webhook/:secret */
export async function handleWebhook(req, res) {
  const bot = botRepo.findBySecret(req.params.secret);
  if (!bot) return res.sendStatus(404);
  res.sendStatus(200);
  handleUpdate(bot, req.body).catch(err =>
    console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'error', msg: 'bot runner error', err: err.message }))
  );
}
