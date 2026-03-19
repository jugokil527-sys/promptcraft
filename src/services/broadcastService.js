/**
 * Broadcast service — отправка рассылок с сегментацией.
 * Запускается при старте бота и проверяет pending broadcasts каждую минуту.
 */
import * as broadcastRepo from '../repositories/broadcastRepository.js';
import * as userRepo from '../repositories/userRepository.js';
import * as analyticsRepo from '../repositories/analyticsRepository.js';

let _bot = null;

export function init(bot) {
  _bot = bot;
  // Проверять pending рассылки каждую минуту
  setInterval(processPending, 60_000);
}

/** Создать рассылку (немедленно или с отложенным стартом) */
export function schedule({ text, segment = 'all', scheduledAt, createdBy }) {
  return broadcastRepo.create({ text, segment, scheduledAt, createdBy });
}

/** Получить список пользователей по сегменту */
function getSegmentUsers(segment) {
  if (segment === 'active') return userRepo.findActive(7);
  if (segment === 'inactive') return userRepo.findInactive(7);
  if (segment.startsWith('tag:')) return userRepo.findByTag(segment.slice(4));
  return userRepo.findAll();
}

/** Отправить рассылку прямо сейчас */
export async function sendNow({ text, segment = 'all', createdBy }) {
  const users = getSegmentUsers(segment);
  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await _bot.telegram.sendMessage(user.id, text, { parse_mode: 'Markdown' });
      sent++;
      // Небольшая задержка чтобы не упереться в Telegram rate limit (30 msg/sec)
      await sleep(50);
    } catch (err) {
      failed++;
      console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'error', msg: 'broadcast send error', userId: user.id, err: err.message }));
    }
  }

  analyticsRepo.track(createdBy, 'broadcast_send', { segment, sent, failed });
  return { sent, failed, total: users.length };
}

/** Обработать pending рассылки */
async function processPending() {
  if (!_bot) return;
  const pending = broadcastRepo.findPending();

  for (const bc of pending) {
    try {
      broadcastRepo.updateStatus(bc.id, 'sending');
      const users = getSegmentUsers(bc.segment);
      let sent = 0;

      for (const user of users) {
        try {
          await _bot.telegram.sendMessage(user.id, bc.text, { parse_mode: 'Markdown' });
          sent++;
          await sleep(50);
        } catch { /* игнорируем ошибки конкретных пользователей */ }
      }

      broadcastRepo.updateStatus(bc.id, 'sent', sent);
      analyticsRepo.track(bc.createdBy, 'broadcast_send', { segment: bc.segment, sent });
      console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', msg: 'broadcast sent', id: bc.id, sent }));
    } catch (err) {
      broadcastRepo.updateStatus(bc.id, 'failed');
      console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'error', msg: 'broadcast failed', id: bc.id, err: err.message }));
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
