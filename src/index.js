/**
 * Entry point.
 * Starts Express server and Telegram bot (if token is set).
 */
import 'dotenv/config';
import { Telegraf, Markup } from 'telegraf';
import { createApp } from './app.js';

const port = Number(process.env.PORT) || 3000;
const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;

// --- Web server ---
const app = createApp();
app.listen(port, () => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', msg: `Web server started on ${baseUrl}` }));
});

// --- Telegram bot ---
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.warn(JSON.stringify({ ts: new Date().toISOString(), level: 'warn', msg: 'TELEGRAM_BOT_TOKEN not set — bot disabled' }));
} else {
  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

  bot.start(async (ctx) => {
    const userId = String(ctx.from?.id || 'guest');
    const webUrl = `${baseUrl}/?userId=${encodeURIComponent(userId)}`;

    await ctx.reply(
      '👋 Это песочница-конструктор мини-аппов с AI-агентом.\nНажми кнопку ниже:',
      Markup.inlineKeyboard([
        Markup.button.webApp('🚀 Открыть конструктор', webUrl),
      ])
    );
  });

  bot.command('course', async (ctx) => {
    await ctx.reply(`📚 Мини-курс: ${baseUrl}/course.html`);
  });

  bot.launch();
  console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', msg: 'Telegram bot started' }));

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
