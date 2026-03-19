/**
 * In-memory rate limiter per userId/chatId.
 * Простой токен-бакет: max N запросов за windowMs миллисекунд.
 * Не требует Redis — работает в одном процессе.
 */

const buckets = new Map(); // key -> { count, resetAt }

export function createRateLimiter({ max = 20, windowMs = 60_000 } = {}) {
  return function rateLimit(key) {
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    if (bucket.count > max) {
      return false; // превышен лимит
    }
    return true;
  };
}

// Чистка устаревших бакетов раз в 5 минут
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}, 5 * 60_000);

// Глобальный лимитер для бота: 30 сообщений/минуту на пользователя
export const botRateLimiter = createRateLimiter({ max: 30, windowMs: 60_000 });
