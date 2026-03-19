/**
 * Сервис шаблонов mini-app.
 * 3 шаблона: payment, codes, universal.
 *
 * Каждый шаблон — это:
 *   steps[]   — массив вопросов пользователю
 *   build()   — принимает ответы и возвращает готовый результат
 */

export const TEMPLATES = {
  payment: {
    id: 'payment',
    emoji: '💳',
    name: 'Бот оплаты',
    description: 'Принимает оплату, отправляет инструкции после',
    steps: [
      { key: 'product',  question: '💳 *Бот оплаты* — Шаг 1/3\n\nКак называется ваш продукт/услуга?\n_Например: «Курс по Python», «Консультация», «Доступ к сервису»_' },
      { key: 'price',    question: 'Шаг 2/3\n\nЦена и способ оплаты?\n_Например: «990 руб., Tinkoff по ссылке» или «$19, USDT TRC20»_' },
      { key: 'delivery', question: 'Шаг 3/3\n\nЧто получает покупатель после оплаты?\n_Например: «Ссылку на курс», «Zoom-ссылку», «Файл PDF»_' },
    ],
  },

  codes: {
    id: 'codes',
    emoji: '🎁',
    name: 'Выдача кодов/товаров',
    description: 'Автоматически выдаёт коды, ключи или ссылки',
    steps: [
      { key: 'product',  question: '🎁 *Выдача кодов* — Шаг 1/3\n\nЧто выдаёте?\n_Например: «промокоды», «ключи активации», «ссылки на скачивание»_' },
      { key: 'trigger',  question: 'Шаг 2/3\n\nКак пользователь получает код? По команде, после оплаты или по кнопке?\n_Например: «нажимает кнопку /getcode», «после оплаты 199р»_' },
      { key: 'codes',    question: 'Шаг 3/3\n\nВставьте список кодов (каждый с новой строки):\n_Например:_\n_PROMO123_\n_PROMO456_\n_PROMO789_' },
    ],
  },

  universal: {
    id: 'universal',
    emoji: '🤖',
    name: 'Универсальный шаблон',
    description: 'Под любую нишу — вопрос/ответ, лид-сбор, консультация',
    steps: [
      { key: 'niche',    question: '🤖 *Универсальный бот* — Шаг 1/3\n\nОпишите нишу и цель бота в 1-2 предложениях.\n_Например: «Бот для записи на стрижку в барбершоп», «Квиз для подбора курса»_' },
      { key: 'scenario', question: 'Шаг 2/3\n\nОпишите основной сценарий: что пользователь делает и что получает?\n_Например: «Выбирает услугу → вводит имя/телефон → получает подтверждение»_' },
      { key: 'cta',      question: 'Шаг 3/3\n\nКакое ключевое действие (CTA) должен совершить пользователь?\n_Например: «Записаться», «Получить PDF», «Пройти тест»_' },
    ],
  },
};

/** Генерирует готовый результат по шаблону и ответам пользователя */
export function buildResult(templateId, answers) {
  const tpl = TEMPLATES[templateId];
  if (!tpl) throw new Error(`Unknown template: ${templateId}`);

  if (templateId === 'payment') {
    return `✅ *Бот оплаты готов!*

📦 *Продукт:* ${answers.product}
💰 *Цена/способ:* ${answers.price}
🎁 *После оплаты:* ${answers.delivery}

*Сценарий бота:*
1. Пользователь нажимает /start
2. Бот показывает описание: «${answers.product}» за ${answers.price}
3. Выводит кнопку «Оплатить» (Telegram Payments или внешняя ссылка)
4. После подтверждения оплаты бот отправляет: ${answers.delivery}

*Следующий шаг:* добавьте payment token в @BotFather → Bot Settings → Payments и настройте webhook на /api/payment.`;
  }

  if (templateId === 'codes') {
    const codesList = answers.codes
      .split('\n')
      .map((c) => c.trim())
      .filter(Boolean);
    return `✅ *Бот выдачи кодов готов!*

📦 *Что выдаёт:* ${answers.product}
🔑 *Триггер:* ${answers.trigger}
📋 *Кодов в базе:* ${codesList.length}

*Коды загружены:*
${codesList.slice(0, 5).map((c) => `• \`${c}\``).join('\n')}${codesList.length > 5 ? `\n...и ещё ${codesList.length - 5}` : ''}

*Сценарий:*
1. ${answers.trigger}
2. Бот берёт следующий код из очереди
3. Отправляет код пользователю: «Ваш ${answers.product}: \`CODE\`»
4. Код помечается как выданный

*Следующий шаг:* сохраните проект и добавьте коды через /api/projects.`;
  }

  // universal
  return `✅ *Универсальный бот настроен!*

🎯 *Ниша:* ${answers.niche}
📋 *Сценарий:* ${answers.scenario}
📣 *CTA:* ${answers.cta}

*Готовая структура бота:*

/start → Приветствие + описание ценности
↓
Кнопка «${answers.cta}» → основной сценарий
↓
${answers.scenario}
↓
Подтверждение + follow-up

*AI-промпт для этого бота:*
\`\`\`
Ты помощник в нише: ${answers.niche}.
Основная задача: ${answers.scenario}.
Ключевое действие: ${answers.cta}.
Отвечай кратко, по делу, на русском.
\`\`\`

*Следующий шаг:* скопируйте промпт в конструктор /app и запустите AI-агента.`;
}
