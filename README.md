# PromptCraft — Telegram Bot Platform

Конструктор Telegram-ботов с AI-агентом, шаблонами, рассылками и аналитикой.

## Возможности

| Функция | Статус |
|---------|--------|
| Онбординг + меню команд | ✅ |
| 3 шаблона (оплата, коды, универсальный) | ✅ |
| AI автоответы (Gemini + FAQ fallback) | ✅ |
| Рассылки + сегментация | ✅ |
| Аналитика (DAU, CTR, retention) | ✅ |
| Webhook prod / polling dev | ✅ |
| Web конструктор блоков | ✅ |

---

## Быстрый старт

```bash
cp .env.example .env
# Заполните .env (минимум TELEGRAM_BOT_TOKEN)
npm install
npm run dev   # dev (polling)
npm start     # prod
```

---

## BotFather Setup Checklist

Откройте @BotFather в Telegram и выполните:

- [ ] `/newbot` — создать бота, получить `TELEGRAM_BOT_TOKEN`
- [ ] `/setdescription` — описание бота (показывается при первом открытии)
- [ ] `/setabouttext` — короткое описание для профиля бота
- [ ] `/setuserpic` — аватар бота
- [ ] `/setcommands` — меню команд (бот сам устанавливает при старте)
- [ ] `/setdomain` — разрешённый домен для Web App (ваш PUBLIC_BASE_URL домен)
- [ ] `/setpayments` — токен платёжного провайдера (для шаблона оплаты)

### Команды для /setcommands в BotFather:
```
start - Главная — онбординг и меню
menu - Главное меню
templates - Конструктор шаблонов
app - Открыть web-конструктор
course - Мини-курс
faq - Частые вопросы
cancel - Отменить текущее действие
```

---

## Переменные окружения

| Переменная | Обязательно | Описание |
|-----------|-------------|----------|
| `TELEGRAM_BOT_TOKEN` | ✅ | Токен из BotFather |
| `PORT` | — | Порт сервера (default: 3000) |
| `PUBLIC_BASE_URL` | — | Публичный URL для Web App кнопок |
| `WEBHOOK_URL` | — | Если задан — включает webhook вместо polling |
| `GEMINI_API_KEY` | — | Google Gemini для AI агента |
| `GEMINI_MODEL` | — | Модель Gemini (default: gemini-2.0-flash) |
| `ADMIN_IDS` | — | Telegram ID администраторов (через запятую) |

---

## Команды бота

| Команда | Описание | Доступ |
|---------|----------|--------|
| `/start` | Онбординг, главное меню | все |
| `/menu` | Инлайн-меню | все |
| `/templates` | Выбор шаблона | все |
| `/app` | Открыть web-конструктор | все |
| `/course` | Мини-курс | все |
| `/faq` | FAQ / автоответы | все |
| `/cancel` | Отменить текущий диалог | все |
| `/stats` | Аналитика (DAU, CTR, retention) | admin |
| `/broadcast` | Создать рассылку | admin |

---

## API Endpoints

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/health` | Статус сервера |
| POST | `/api/projects` | Создать/обновить проект |
| GET | `/api/projects/:id` | Получить проект |
| DELETE | `/api/projects/:id` | Удалить проект |
| GET | `/api/users/:userId/projects` | Проекты пользователя |
| POST | `/api/agent/run` | Запустить AI агент |

---

## Dev/Prod запуск

### Dev (polling):
```bash
npm run dev
# Для Web App нужен публичный URL (ngrok):
# ngrok http 3000
# Задайте PUBLIC_BASE_URL=https://xxxx.ngrok.io в .env
```

### Prod (VPS + webhook):
```bash
# .env:
# WEBHOOK_URL=https://yourdomain.com
# PUBLIC_BASE_URL=https://yourdomain.com
# PORT=3000
npm start
```

### Prod (Vercel):
```bash
vercel deploy
# Env переменные задайте в Vercel dashboard
```

---

## Структура проекта

```
src/
  bot/
    handlers.js      — обработчики бота (FSM + команды)
    states.js        — in-memory FSM состояния
  middleware/
    errorHandler.js  — обработчик ошибок
    rateLimiter.js   — rate limiting
    requestLogger.js — JSON логи
    validate.js      — валидация
  repositories/
    projectRepository.js    — CRUD проектов
    userRepository.js       — пользователи
    dialogRepository.js     — логи диалогов
    analyticsRepository.js  — события аналитики
    broadcastRepository.js  — рассылки
  services/
    agentService.js      — AI агент (Gemini)
    analyticsService.js  — агрегация аналитики
    broadcastService.js  — отправка рассылок
    faqService.js        — FAQ автоответы
    projectService.js    — бизнес-логика проектов
    templateService.js   — шаблоны + генератор
  app.js       — Express app
  index.js     — entry point
  vercel.js    — Vercel adapter
data/          — JSON хранилище (gitignored)
public/        — статика
```

---

## Roadmap v2

- [ ] PostgreSQL вместо JSON файлов
- [ ] Авторизация через Telegram WebApp (initData validation)
- [ ] Дополнительные шаблоны (запись, викторина, лид-магнит)
- [ ] Cron-планировщик рассылок
- [ ] Экспорт аналитики в CSV
- [ ] AI ответы в диалоге через Gemini (не только FAQ)
- [ ] Платёжная интеграция (Telegram Payments)
