/**
 * FAQ сервис — автоответы на типовые вопросы.
 * Простое keyword-matching без AI (работает без API-ключа).
 * Если совпадение не найдено — возвращает null (fallback на Gemini или ручной ответ).
 */

const FAQ = [
  {
    keywords: ['цена', 'сколько стоит', 'стоимость', 'тариф', 'платно', 'бесплатно'],
    answer: '💰 PromptCraft бесплатен для базового использования. Для продвинутых функций (больше шаблонов, AI автоответы) — напишите /pricing.',
  },
  {
    keywords: ['как начать', 'с чего начать', 'начало', 'первый шаг', 'помощь'],
    answer: '🚀 Начните с команды /templates — выберите готовый шаблон и за 3 шага получите работающего бота.',
  },
  {
    keywords: ['шаблон', 'template', 'готовый', 'пример'],
    answer: '📋 Доступны 3 шаблона:\n💳 Бот оплаты\n🎁 Выдача кодов\n🤖 Универсальный\n\nВыберите: /templates',
  },
  {
    keywords: ['webhook', 'webhooks', 'деплой', 'deploy', 'продакшн', 'production'],
    answer: '⚙️ Для продакшн деплоя: задайте WEBHOOK_URL в .env — бот автоматически переключится с polling на webhook режим.',
  },
  {
    keywords: ['api', 'ключ', 'gemini', 'openai', 'ai', 'искусственный', 'нейросеть'],
    answer: '🤖 AI-агент работает через Google Gemini. Добавьте GEMINI_API_KEY в .env для активации. Без ключа работает mock-режим.',
  },
  {
    keywords: ['ошибка', 'error', 'не работает', 'проблема', 'баг'],
    answer: '🔧 Опишите проблему подробнее, и я передам её разработчику. Также проверьте /health для статуса сервера.',
  },
  {
    keywords: ['рассылка', 'broadcast', 'уведомление', 'сообщение всем'],
    answer: '📢 Для рассылки используйте команду /broadcast (только для администраторов).',
  },
  {
    keywords: ['статистика', 'аналитика', 'stats', 'дау', 'dau'],
    answer: '📊 Статистика доступна через команду /stats (только для администраторов).',
  },
];

/**
 * Найти ответ по тексту сообщения.
 * @returns {string|null} — ответ или null если не найдено
 */
export function findAnswer(text) {
  if (!text) return null;
  const lower = text.toLowerCase();

  for (const item of FAQ) {
    if (item.keywords.some((kw) => lower.includes(kw))) {
      return item.answer;
    }
  }
  return null;
}

/** Список всех FAQ для команды /faq */
export function getAllFAQ() {
  return FAQ.map((item) => ({
    question: item.keywords.slice(0, 2).join(' / '),
    answer: item.answer,
  }));
}
