/**
 * Все обработчики Telegram-бота.
 * Подключается к экземпляру bot из index.js.
 *
 * Команды:
 *   /start      — онбординг + регистрация пользователя
 *   /menu       — главное меню
 *   /templates  — выбор шаблона
 *   /app        — открыть конструктор WebApp
 *   /course     — мини-курс
 *   /faq        — частые вопросы
 *   /stats      — аналитика (только admin)
 *   /broadcast  — создать рассылку (только admin)
 *   /cancel     — отменить текущий диалог
 */
import { Markup } from 'telegraf';
import * as userRepo from '../repositories/userRepository.js';
import * as analyticsRepo from '../repositories/analyticsRepository.js';
import * as dialogRepo from '../repositories/dialogRepository.js';
import { getState, setState, clearState, mergeData } from './states.js';
import { TEMPLATES, buildResult } from '../services/templateService.js';
import { findAnswer } from '../services/faqService.js';
import { botRateLimiter } from '../middleware/rateLimiter.js';
import * as broadcastService from '../services/broadcastService.js';
import * as broadcastRepo from '../repositories/broadcastRepository.js';
import * as analyticsService from '../services/analyticsService.js';

const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);

function isAdmin(userId) {
  return ADMIN_IDS.includes(String(userId));
}

/** Регистрация/обновление пользователя */
function touchUser(from) {
  const now = new Date().toISOString();
  const existing = userRepo.findById(from.id);
  userRepo.upsert({
    id: String(from.id),
    username: from.username || null,
    firstName: from.first_name || '',
    lastName: from.last_name || '',
    joinedAt: existing?.joinedAt || now,
    lastActive: now,
    tags: existing?.tags || [],
    onboarded: existing?.onboarded || false,
  });
  return existing;
}

export function registerHandlers(bot, baseUrl) {

  // ── Rate limiting middleware ──────────────────────────────────────────────
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (userId && !botRateLimiter(String(userId))) {
      return ctx.reply('⚠️ Слишком много запросов. Подождите минуту.');
    }
    return next();
  });

  // ── /start ────────────────────────────────────────────────────────────────
  bot.start(async (ctx) => {
    const existing = touchUser(ctx.from);
    const userId = String(ctx.from.id);
    analyticsRepo.track(userId, 'start');
    clearState(userId);

    if (!existing?.onboarded) {
      // Первый визит — онбординг
      userRepo.upsert({ id: userId, onboarded: true });
      await ctx.replyWithMarkdown(
        `👋 Привет, ${ctx.from.first_name}!\n\n` +
        `*PromptCraft* — конструктор Telegram-ботов с AI.\n\n` +
        `За 3 шага создай:\n` +
        `• 💳 Бота для приёма оплат\n` +
        `• 🎁 Бота для выдачи кодов/ключей\n` +
        `• 🤖 Бота под любую нишу\n\n` +
        `Нажми кнопку — выбери шаблон:`,
        Markup.inlineKeyboard([
          [Markup.button.callback('📋 Выбрать шаблон', 'action:templates')],
          [Markup.button.webApp('🔧 Открыть конструктор', `${baseUrl}/?userId=${userId}`)],
          [Markup.button.callback('❓ FAQ', 'action:faq')],
        ])
      );
      analyticsRepo.track(userId, 'onboarding_start');
    } else {
      // Повторный визит — короткое приветствие
      await ctx.replyWithMarkdown(
        `С возвращением, ${ctx.from.first_name}! 👋`,
        Markup.inlineKeyboard([
          [Markup.button.callback('📋 Шаблоны', 'action:templates'), Markup.button.callback('📊 Статистика', 'action:stats')],
          [Markup.button.webApp('🔧 Конструктор', `${baseUrl}/?userId=${userId}`)],
        ])
      );
    }
  });

  // ── /menu ─────────────────────────────────────────────────────────────────
  bot.command('menu', async (ctx) => {
    touchUser(ctx.from);
    const userId = String(ctx.from.id);
    analyticsRepo.track(userId, 'button_click', { button: 'menu' });
    clearState(userId);

    const adminButtons = isAdmin(userId)
      ? [[Markup.button.callback('📢 Рассылка', 'action:broadcast'), Markup.button.callback('📊 Аналитика', 'action:stats')]]
      : [];

    await ctx.replyWithMarkdown(
      '📋 *Главное меню*',
      Markup.inlineKeyboard([
        [Markup.button.callback('📋 Шаблоны', 'action:templates')],
        [Markup.button.webApp('🔧 Конструктор', `${baseUrl}/?userId=${userId}`)],
        [Markup.button.callback('❓ FAQ', 'action:faq'), Markup.button.callback('📚 Курс', 'action:course')],
        ...adminButtons,
      ])
    );
  });

  // ── /templates ────────────────────────────────────────────────────────────
  bot.command('templates', async (ctx) => {
    touchUser(ctx.from);
    showTemplates(ctx);
  });

  // ── /app ──────────────────────────────────────────────────────────────────
  bot.command('app', async (ctx) => {
    touchUser(ctx.from);
    const userId = String(ctx.from.id);
    analyticsRepo.track(userId, 'button_click', { button: 'app' });
    await ctx.reply(
      '🔧 Открыть конструктор:',
      Markup.inlineKeyboard([[Markup.button.webApp('Открыть', `${baseUrl}/?userId=${userId}`)]])
    );
  });

  // ── /course ───────────────────────────────────────────────────────────────
  bot.command('course', async (ctx) => {
    touchUser(ctx.from);
    analyticsRepo.track(String(ctx.from.id), 'button_click', { button: 'course' });
    await ctx.reply(
      '📚 Мини-курс по созданию Telegram-ботов:',
      Markup.inlineKeyboard([[Markup.button.url('Открыть курс', `${baseUrl}/course.html`)]])
    );
  });

  // ── /faq ─────────────────────────────────────────────────────────────────
  bot.command('faq', async (ctx) => {
    touchUser(ctx.from);
    analyticsRepo.track(String(ctx.from.id), 'button_click', { button: 'faq' });
    await ctx.replyWithMarkdown(
      '❓ *Частые вопросы*\n\n' +
      'Напишите вопрос — я отвечу автоматически.\n\n' +
      'Темы: цена, шаблоны, webhook, AI, рассылки, ошибки.'
    );
  });

  // ── /cancel ────────────────────────────────────────────────────────────────
  bot.command('cancel', async (ctx) => {
    const userId = String(ctx.from.id);
    clearState(userId);
    await ctx.reply('❌ Действие отменено. Напишите /menu для возврата в меню.');
  });

  // ── /stats (admin) ────────────────────────────────────────────────────────
  bot.command('stats', async (ctx) => {
    touchUser(ctx.from);
    const userId = String(ctx.from.id);
    if (!isAdmin(userId)) return ctx.reply('⛔️ Нет доступа.');
    await sendStats(ctx);
  });

  // ── /broadcast (admin) ───────────────────────────────────────────────────
  bot.command('broadcast', async (ctx) => {
    touchUser(ctx.from);
    const userId = String(ctx.from.id);
    if (!isAdmin(userId)) return ctx.reply('⛔️ Нет доступа.');

    setState(userId, 'broadcast:compose', {});
    await ctx.replyWithMarkdown(
      '📢 *Создание рассылки*\n\n' +
      'Введите текст рассылки (поддерживается Markdown).\n\n' +
      '/cancel — отменить'
    );
  });

  // ── Inline кнопки (callback_query) ───────────────────────────────────────
  bot.action('action:templates', async (ctx) => {
    await ctx.answerCbQuery();
    touchUser(ctx.from);
    analyticsRepo.track(String(ctx.from.id), 'button_click', { button: 'templates' });
    showTemplates(ctx);
  });

  bot.action('action:faq', async (ctx) => {
    await ctx.answerCbQuery();
    analyticsRepo.track(String(ctx.from.id), 'button_click', { button: 'faq' });
    await ctx.replyWithMarkdown('❓ Напишите ваш вопрос — я отвечу автоматически.\n\nТемы: цена, шаблоны, webhook, AI, рассылки, ошибки.');
  });

  bot.action('action:stats', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(String(ctx.from.id))) return ctx.reply('⛔️ Нет доступа.');
    sendStats(ctx);
  });

  bot.action('action:course', async (ctx) => {
    await ctx.answerCbQuery();
    analyticsRepo.track(String(ctx.from.id), 'button_click', { button: 'course' });
    await ctx.reply('📚 Курс:', Markup.inlineKeyboard([[Markup.button.url('Открыть', `${baseUrl}/course.html`)]]))
  });

  bot.action('action:broadcast', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = String(ctx.from.id);
    if (!isAdmin(userId)) return ctx.reply('⛔️ Нет доступа.');
    setState(userId, 'broadcast:compose', {});
    await ctx.replyWithMarkdown('📢 Введите текст рассылки:');
  });

  // Выбор шаблона через кнопку
  bot.action(/^tpl:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const templateId = ctx.match[1];
    const userId = String(ctx.from.id);
    touchUser(ctx.from);
    analyticsRepo.track(userId, 'template_start', { templateId });

    const tpl = TEMPLATES[templateId];
    if (!tpl) return ctx.reply('Шаблон не найден.');

    setState(userId, `template:${templateId}:1`, { templateId, answers: {} });
    await ctx.replyWithMarkdown(tpl.steps[0].question);
  });

  // Выбор сегмента рассылки
  bot.action(/^segment:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const segment = ctx.match[1];
    const userId = String(ctx.from.id);
    const state = getState(userId);

    if (!state.data?.text) return ctx.reply('Текст рассылки не найден. Начните заново: /broadcast');

    mergeData(userId, { segment });
    setState(userId, 'broadcast:confirm', state.data);

    const users = getUserCountBySegment(segment);
    await ctx.replyWithMarkdown(
      `📢 *Подтверждение рассылки*\n\n` +
      `Текст:\n${state.data.text}\n\n` +
      `Сегмент: *${segmentLabel(segment)}* (~${users} чел.)\n\n` +
      `Отправить сейчас?`,
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Да, отправить', 'broadcast:send'), Markup.button.callback('❌ Отмена', 'broadcast:cancel')],
      ])
    );
  });

  bot.action('broadcast:send', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = String(ctx.from.id);
    const state = getState(userId);
    clearState(userId);

    await ctx.reply('📤 Начинаю рассылку...');
    try {
      const result = await broadcastService.sendNow({ text: state.data.text, segment: state.data.segment, createdBy: userId });
      await ctx.replyWithMarkdown(`✅ Рассылка завершена:\n• Отправлено: *${result.sent}*\n• Ошибок: ${result.failed}`);
    } catch (err) {
      await ctx.reply(`❌ Ошибка: ${err.message}`);
    }
  });

  bot.action('broadcast:cancel', async (ctx) => {
    await ctx.answerCbQuery();
    clearState(String(ctx.from.id));
    await ctx.reply('❌ Рассылка отменена.');
  });

  // ── Текстовые сообщения — FSM ─────────────────────────────────────────────
  bot.on('text', async (ctx) => {
    const userId = String(ctx.from.id);
    const text = ctx.message.text;
    touchUser(ctx.from);

    // Логируем входящее сообщение
    dialogRepo.append({ userId, role: 'user', text });
    analyticsRepo.track(userId, 'message');

    const state = getState(userId);
    const { step } = state;

    // ── Broadcast: ввод текста ──────────────────────────────────────────────
    if (step === 'broadcast:compose') {
      if (!isAdmin(userId)) { clearState(userId); return; }
      mergeData(userId, { text });
      setState(userId, 'broadcast:segment', state.data);

      await ctx.replyWithMarkdown(
        '📊 *Выберите сегмент:*',
        Markup.inlineKeyboard([
          [Markup.button.callback(`👥 Все пользователи`, 'segment:all')],
          [Markup.button.callback('✅ Активные (7 дней)', 'segment:active'), Markup.button.callback('😴 Неактивные', 'segment:inactive')],
        ])
      );
      return;
    }

    // ── Template FSM ─────────────────────────────────────────────────────────
    if (step.startsWith('template:')) {
      return handleTemplateStep(ctx, userId, text, state);
    }

    // ── FAQ автоответ ─────────────────────────────────────────────────────────
    const faqAnswer = findAnswer(text);
    if (faqAnswer) {
      dialogRepo.append({ userId, role: 'bot', text: faqAnswer });
      await ctx.replyWithMarkdown(faqAnswer);
      return;
    }

    // ── Fallback ──────────────────────────────────────────────────────────────
    dialogRepo.append({ userId, role: 'user', text, fallback: true });
    await ctx.replyWithMarkdown(
      '🤔 Не нашёл ответа на ваш вопрос.\n\n' +
      'Попробуйте:\n• /faq — частые вопросы\n• /templates — шаблоны\n• /menu — главное меню\n\n' +
      '_Или опишите вопрос подробнее — я передам его команде._'
    );
  });

  // ── Шаги шаблонов ────────────────────────────────────────────────────────
  async function handleTemplateStep(ctx, userId, text, state) {
    const parts = state.step.split(':'); // template:payment:1
    const templateId = parts[1];
    const stepNum = parseInt(parts[2], 10);
    const tpl = TEMPLATES[templateId];

    if (!tpl) {
      clearState(userId);
      return ctx.reply('Шаблон не найден. Начните заново: /templates');
    }

    const currentStep = tpl.steps[stepNum - 1];
    mergeData(userId, { answers: { ...state.data.answers, [currentStep.key]: text } });

    if (stepNum < tpl.steps.length) {
      // Следующий шаг
      const nextStep = tpl.steps[stepNum];
      setState(userId, `template:${templateId}:${stepNum + 1}`, getState(userId).data);
      await ctx.replyWithMarkdown(nextStep.question);
    } else {
      // Все шаги пройдены — генерируем результат
      const answers = getState(userId).data.answers;
      clearState(userId);

      analyticsRepo.track(userId, 'template_complete', { templateId });
      analyticsRepo.track(userId, 'conversion', { templateId });

      const result = buildResult(templateId, answers);
      dialogRepo.append({ userId, role: 'bot', text: result });

      await ctx.replyWithMarkdown(result, Markup.inlineKeyboard([
        [Markup.button.callback('📋 Другой шаблон', 'action:templates')],
        [Markup.button.callback('📋 Главное меню', 'action:templates')],
      ]));
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function showTemplates(ctx) {
  const userId = String(ctx.from?.id || ctx.callbackQuery?.from?.id);
  analyticsRepo.track(userId, 'templates_view');

  await ctx.replyWithMarkdown(
    '📋 *Выберите шаблон:*\n\n' +
    Object.values(TEMPLATES).map((t) => `${t.emoji} *${t.name}* — ${t.description}`).join('\n'),
    Markup.inlineKeyboard(
      Object.values(TEMPLATES).map((t) => [Markup.button.callback(`${t.emoji} ${t.name}`, `tpl:${t.id}`)])
    )
  );
}

async function sendStats(ctx) {
  const stats = analyticsService.getSummary();
  await ctx.replyWithMarkdown(
    `📊 *Аналитика*\n\n` +
    `👥 Всего пользователей: *${stats.totalUsers}*\n` +
    `📅 DAU сегодня: *${stats.dauToday}*\n` +
    `🔄 Конверсия start→template: *${stats.conversion.rate}%*\n` +
    `📝 Шаблонов завершено: *${stats.templatesDone}*\n\n` +
    `*Кнопки (CTR):*\n${Object.entries(stats.ctr).map(([k, v]) => `• ${k}: ${v}`).join('\n') || '—'}\n\n` +
    `*Retention:*\n• D1: ${stats.retention.retDay1}\n• D7: ${stats.retention.retDay7}`
  );
}

function getUserCountBySegment(segment) {
  if (segment === 'active') return userRepo.findActive(7).length;
  if (segment === 'inactive') return userRepo.findInactive(7).length;
  return userRepo.count();
}

function segmentLabel(segment) {
  if (segment === 'active') return 'Активные (7 дней)';
  if (segment === 'inactive') return 'Неактивные';
  if (segment.startsWith('tag:')) return `Тег: ${segment.slice(4)}`;
  return 'Все пользователи';
}
