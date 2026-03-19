/**
 * Entry point.
 * - Поднимает Express сервер
 * - Запускает Telegram бот (polling в dev, webhook в prod)
 * - Инициализирует broadcastService
 */
import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { createApp } from './app.js';
import { registerHandlers } from './bot/handlers.js';
import * as broadcastService from './services/broadcastService.js';

const port = Number(process.env.PORT) || 3000;
const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;
const webhookUrl = process.env.WEBHOOK_URL || null;

const log = (level, msg, extra = {}) =>
  console[level === 'error' ? 'error' : 'log'](JSON.stringify({
    ts: new Date().toISOString(), level, msg, ...extra
  }));

// ── Web server ──────────────────────────────────────────────────────────────
const app = createApp();

// ── Telegram bot ────────────────────────────────────────────────────────────
if (!process.env.TELEGRAM_BOT_TOKEN) {
  log('warn', 'TELEGRAM_BOT_TOKEN not set — bot disabled');
} else {
  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

  // Устанавливаем команды в меню Telegram (BotFather-like experience)
  bot.telegram.setMyCommands([
    { command: 'start',     description: 'Главная — онбординг и меню' },
    { command: 'menu',      description: 'Главное меню' },
    { command: 'templates', description: '📋 Конструктор шаблонов' },
    { command: 'app',       description: '🔧 Открыть web-конструктор' },
    { command: 'course',    description: '📚 Мини-курс' },
    { command: 'faq',       description: '❓ Частые вопросы' },
    { command: 'cancel',    description: '✖️ Отменить текущее действие' },
  ]).catch((err) => log('warn', 'setMyCommands failed', { err: err.message }));

  // Регистрируем все обработчики
  registerHandlers(bot, baseUrl);

  // Инициализируем планировщик рассылок
  broadcastService.init(bot);

  // Global error handler для бота
  bot.catch((err, ctx) => {
    log('error', 'Bot error', { err: err.message, userId: ctx.from?.id });
    ctx.reply('⚠️ Произошла ошибка. Попробуйте ещё раз или напишите /start').catch(() => {});
  });

  if (webhookUrl) {
    // ── PROD: webhook mode ──────────────────────────────────────────────────
    const webhookPath = `/bot${process.env.TELEGRAM_BOT_TOKEN}`;
    app.use(bot.webhookCallback(webhookPath));
    await bot.telegram.setWebhook(`${webhookUrl}${webhookPath}`);
    log('info', `Bot started in webhook mode`, { url: webhookUrl + webhookPath });
  } else {
    // ── DEV: polling mode ───────────────────────────────────────────────────
    await bot.telegram.deleteWebhook();
    bot.launch();
    log('info', 'Bot started in polling mode');
  }

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

// Стартуем сервер после настройки бота
app.listen(port, () => {
  log('info', `Web server started`, { url: baseUrl });
});
