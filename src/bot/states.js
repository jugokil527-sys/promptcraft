/**
 * In-memory FSM состояний пользователей бота.
 * Хранит текущий шаг + накопленные данные диалога.
 *
 * Состояния:
 *   idle                  — ожидание команды
 *   template:choose       — выбор шаблона
 *   template:payment:1..3 — шаги шаблона "бот оплаты"
 *   template:codes:1..3   — шаги шаблона "выдача кодов"
 *   template:universal:1..3 — шаги универсального шаблона
 *   broadcast:compose     — ввод текста рассылки (только для admin)
 *   broadcast:confirm     — подтверждение рассылки
 */

const states = new Map(); // userId -> { step, data, ts }

export function getState(userId) {
  return states.get(String(userId)) || { step: 'idle', data: {} };
}

export function setState(userId, step, data = {}) {
  states.set(String(userId), { step, data, ts: Date.now() });
}

export function clearState(userId) {
  states.set(String(userId), { step: 'idle', data: {}, ts: Date.now() });
}

export function mergeData(userId, extra) {
  const current = getState(userId);
  setState(userId, current.step, { ...current.data, ...extra });
}

// Чистка устаревших состояний (старше 30 минут)
setInterval(() => {
  const cutoff = Date.now() - 30 * 60_000;
  for (const [id, state] of states.entries()) {
    if (state.ts < cutoff) states.delete(id);
  }
}, 10 * 60_000);
