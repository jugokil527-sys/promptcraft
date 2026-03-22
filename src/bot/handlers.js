/**
 * All Telegram bot handlers.
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

  // ── Rate limiting ─────────────────────────────────────────────────────────
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (userId && !botRateLimiter(String(userId))) {
      return ctx.reply('⚠️ Too many requests. Please wait a minute.');
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
      userRepo.upsert({ id: userId, onboarded: true });
      await ctx.reply(`👋 Hey, ${ctx.from.first_name}! Great to have you here.`);
      await ctx.replyWithMarkdown(
        `*PromptCraft* — AI-powered Telegram bot builder.\n\n` +
        `Build in 3 steps:\n` +
        `• 💳 Payment bot\n` +
        `• 🎁 Key/code delivery bot\n` +
        `• 🤖 Bot for any niche\n\n` +
        `Choose a template to get started:`,
        Markup.inlineKeyboard([
          [Markup.button.callback('📋 Templates', 'action:templates'), Markup.button.callback('❓ FAQ', 'action:faq')],
          [Markup.button.webApp('🔧 Open Builder', `${baseUrl}/?userId=${userId}`)],
        ])
      );
      analyticsRepo.track(userId, 'onboarding_start');
    } else {
      await ctx.reply(`Welcome back, ${ctx.from.first_name}! 👋 Good to see you again.`);
      await ctx.replyWithMarkdown(
        `Ready to continue?`,
        Markup.inlineKeyboard([
          [Markup.button.callback('📋 Templates', 'action:templates'), Markup.button.callback('📊 Stats', 'action:stats')],
          [Markup.button.webApp('🔧 Builder', `${baseUrl}/?userId=${userId}`)],
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
      ? [[Markup.button.callback('📢 Broadcast', 'action:broadcast'), Markup.button.callback('📊 Analytics', 'action:stats')]]
      : [];

    await ctx.replyWithMarkdown(
      '📋 *Main Menu*',
      Markup.inlineKeyboard([
        [Markup.button.callback('📋 Templates', 'action:templates')],
        [Markup.button.webApp('🔧 Builder', `${baseUrl}/?userId=${userId}`)],
        [Markup.button.callback('❓ FAQ', 'action:faq'), Markup.button.callback('📚 Course', 'action:course')],
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
      '🔧 Open the builder:',
      Markup.inlineKeyboard([[Markup.button.webApp('Open', `${baseUrl}/?userId=${userId}`)]])
    );
  });

  // ── /course ───────────────────────────────────────────────────────────────
  bot.command('course', async (ctx) => {
    touchUser(ctx.from);
    analyticsRepo.track(String(ctx.from.id), 'button_click', { button: 'course' });
    await ctx.reply(
      '📚 Mini-course on building Telegram bots:',
      Markup.inlineKeyboard([[Markup.button.url('Open Course', `${baseUrl}/course.html`)]])
    );
  });

  // ── /faq ──────────────────────────────────────────────────────────────────
  bot.command('faq', async (ctx) => {
    touchUser(ctx.from);
    analyticsRepo.track(String(ctx.from.id), 'button_click', { button: 'faq' });
    await ctx.replyWithMarkdown(
      '❓ *FAQ*\n\n' +
      'Ask your question — I\'ll answer automatically.\n\n' +
      'Topics: pricing, templates, webhook, AI, broadcasts, errors.'
    );
  });

  // ── /cancel ───────────────────────────────────────────────────────────────
  bot.command('cancel', async (ctx) => {
    const userId = String(ctx.from.id);
    clearState(userId);
    await ctx.reply('❌ Action cancelled. Type /menu to go back.');
  });

  // ── /stats (admin) ────────────────────────────────────────────────────────
  bot.command('stats', async (ctx) => {
    touchUser(ctx.from);
    const userId = String(ctx.from.id);
    if (!isAdmin(userId)) return ctx.reply('⛔️ Access denied.');
    await sendStats(ctx);
  });

  // ── /broadcast (admin) ────────────────────────────────────────────────────
  bot.command('broadcast', async (ctx) => {
    touchUser(ctx.from);
    const userId = String(ctx.from.id);
    if (!isAdmin(userId)) return ctx.reply('⛔️ Access denied.');

    setState(userId, 'broadcast:compose', {});
    await ctx.replyWithMarkdown(
      '📢 *Create Broadcast*\n\n' +
      'Enter the broadcast message (Markdown supported).\n\n' +
      '/cancel — cancel'
    );
  });

  // ── Inline buttons ────────────────────────────────────────────────────────
  bot.action('action:templates', async (ctx) => {
    await ctx.answerCbQuery();
    touchUser(ctx.from);
    analyticsRepo.track(String(ctx.from.id), 'button_click', { button: 'templates' });
    showTemplates(ctx);
  });

  bot.action('action:faq', async (ctx) => {
    await ctx.answerCbQuery();
    analyticsRepo.track(String(ctx.from.id), 'button_click', { button: 'faq' });
    await ctx.replyWithMarkdown('❓ Ask your question — I\'ll answer automatically.\n\nTopics: pricing, templates, webhook, AI, broadcasts, errors.');
  });

  bot.action('action:stats', async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(String(ctx.from.id))) return ctx.reply('⛔️ Access denied.');
    sendStats(ctx);
  });

  bot.action('action:course', async (ctx) => {
    await ctx.answerCbQuery();
    analyticsRepo.track(String(ctx.from.id), 'button_click', { button: 'course' });
    await ctx.reply('📚 Course:', Markup.inlineKeyboard([[Markup.button.url('Open', `${baseUrl}/course.html`)]]))
  });

  bot.action('action:broadcast', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = String(ctx.from.id);
    if (!isAdmin(userId)) return ctx.reply('⛔️ Access denied.');
    setState(userId, 'broadcast:compose', {});
    await ctx.replyWithMarkdown('📢 Enter the broadcast message:');
  });

  bot.action(/^tpl:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const templateId = ctx.match[1];
    const userId = String(ctx.from.id);
    touchUser(ctx.from);
    analyticsRepo.track(userId, 'template_start', { templateId });

    const tpl = TEMPLATES[templateId];
    if (!tpl) return ctx.reply('Template not found.');

    setState(userId, `template:${templateId}:1`, { templateId, answers: {} });
    await ctx.replyWithMarkdown(tpl.steps[0].question);
  });

  bot.action(/^segment:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const segment = ctx.match[1];
    const userId = String(ctx.from.id);
    const state = getState(userId);

    if (!state.data?.text) return ctx.reply('Broadcast text not found. Start over: /broadcast');

    mergeData(userId, { segment });
    setState(userId, 'broadcast:confirm', state.data);

    const users = getUserCountBySegment(segment);
    await ctx.replyWithMarkdown(
      `📢 *Confirm Broadcast*\n\n` +
      `Message:\n${state.data.text}\n\n` +
      `Segment: *${segmentLabel(segment)}* (~${users} users)\n\n` +
      `Send now?`,
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Yes, send', 'broadcast:send'), Markup.button.callback('❌ Cancel', 'broadcast:cancel')],
      ])
    );
  });

  bot.action('broadcast:send', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = String(ctx.from.id);
    const state = getState(userId);
    clearState(userId);

    await ctx.reply('📤 Sending broadcast...');
    try {
      const result = await broadcastService.sendNow({ text: state.data.text, segment: state.data.segment, createdBy: userId });
      await ctx.replyWithMarkdown(`✅ Broadcast complete:\n• Sent: *${result.sent}*\n• Failed: ${result.failed}`);
    } catch (err) {
      await ctx.reply(`❌ Error: ${err.message}`);
    }
  });

  bot.action('broadcast:cancel', async (ctx) => {
    await ctx.answerCbQuery();
    clearState(String(ctx.from.id));
    await ctx.reply('❌ Broadcast cancelled.');
  });

  // ── Text messages — FSM ───────────────────────────────────────────────────
  bot.on('text', async (ctx) => {
    const userId = String(ctx.from.id);
    const text = ctx.message.text;
    touchUser(ctx.from);

    dialogRepo.append({ userId, role: 'user', text });
    analyticsRepo.track(userId, 'message');

    const state = getState(userId);
    const { step } = state;

    if (step === 'broadcast:compose') {
      if (!isAdmin(userId)) { clearState(userId); return; }
      mergeData(userId, { text });
      setState(userId, 'broadcast:segment', state.data);

      await ctx.replyWithMarkdown(
        '📊 *Choose segment:*',
        Markup.inlineKeyboard([
          [Markup.button.callback(`👥 All users`, 'segment:all')],
          [Markup.button.callback('✅ Active (7 days)', 'segment:active'), Markup.button.callback('😴 Inactive', 'segment:inactive')],
        ])
      );
      return;
    }

    if (step.startsWith('template:')) {
      return handleTemplateStep(ctx, userId, text, state);
    }

    const faqAnswer = findAnswer(text);
    if (faqAnswer) {
      dialogRepo.append({ userId, role: 'bot', text: faqAnswer });
      await ctx.replyWithMarkdown(faqAnswer);
      return;
    }

    dialogRepo.append({ userId, role: 'user', text, fallback: true });
    await ctx.replyWithMarkdown(
      '🤔 I couldn\'t find an answer to your question.\n\n' +
      'Try:\n• /faq — frequently asked questions\n• /templates — templates\n• /menu — main menu\n\n' +
      '_Or describe your question in more detail._'
    );
  });

  async function handleTemplateStep(ctx, userId, text, state) {
    const parts = state.step.split(':');
    const templateId = parts[1];
    const stepNum = parseInt(parts[2], 10);
    const tpl = TEMPLATES[templateId];

    if (!tpl) {
      clearState(userId);
      return ctx.reply('Template not found. Start over: /templates');
    }

    const currentStep = tpl.steps[stepNum - 1];
    mergeData(userId, { answers: { ...state.data.answers, [currentStep.key]: text } });

    if (stepNum < tpl.steps.length) {
      const nextStep = tpl.steps[stepNum];
      setState(userId, `template:${templateId}:${stepNum + 1}`, getState(userId).data);
      await ctx.replyWithMarkdown(nextStep.question);
    } else {
      const answers = getState(userId).data.answers;
      clearState(userId);

      analyticsRepo.track(userId, 'template_complete', { templateId });
      analyticsRepo.track(userId, 'conversion', { templateId });

      const result = buildResult(templateId, answers);
      dialogRepo.append({ userId, role: 'bot', text: result });

      await ctx.replyWithMarkdown(result, Markup.inlineKeyboard([
        [Markup.button.callback('📋 Another template', 'action:templates')],
        [Markup.button.callback('🏠 Main menu', 'action:templates')],
      ]));
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function showTemplates(ctx) {
  const userId = String(ctx.from?.id || ctx.callbackQuery?.from?.id);
  analyticsRepo.track(userId, 'templates_view');

  await ctx.replyWithMarkdown(
    '📋 *Choose a template:*\n\n' +
    Object.values(TEMPLATES).map((t) => `${t.emoji} *${t.name}* — ${t.description}`).join('\n'),
    Markup.inlineKeyboard(
      Object.values(TEMPLATES).map((t) => [Markup.button.callback(`${t.emoji} ${t.name}`, `tpl:${t.id}`)])
    )
  );
}

async function sendStats(ctx) {
  const stats = analyticsService.getSummary();
  await ctx.replyWithMarkdown(
    `📊 *Analytics*\n\n` +
    `👥 Total users: *${stats.totalUsers}*\n` +
    `📅 DAU today: *${stats.dauToday}*\n` +
    `🔄 Conversion start→template: *${stats.conversion.rate}%*\n` +
    `📝 Templates completed: *${stats.templatesDone}*\n\n` +
    `*Buttons (CTR):*\n${Object.entries(stats.ctr).map(([k, v]) => `• ${k}: ${v}`).join('\n') || '—'}\n\n` +
    `*Retention:*\n• D1: ${stats.retention.retDay1}\n• D7: ${stats.retention.retDay7}`
  );
}

function getUserCountBySegment(segment) {
  if (segment === 'active') return userRepo.findActive(7).length;
  if (segment === 'inactive') return userRepo.findInactive(7).length;
  return userRepo.count();
}

function segmentLabel(segment) {
  if (segment === 'active') return 'Active (7 days)';
  if (segment === 'inactive') return 'Inactive';
  if (segment.startsWith('tag:')) return `Tag: ${segment.slice(4)}`;
  return 'All users';
}
