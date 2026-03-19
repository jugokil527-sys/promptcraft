# Mini App AI Sandbox (MVP)

Telegram-бот с кнопкой WebApp + песочница-конструктор простых мини-аппов с AI агентом.

## Что внутри
- Telegram bot (`/start`, `/course`)
- Web конструктор блоков: `input/prompt/rule/output`
- API для сохранения проектов
- Endpoint для запуска AI-агента (`/api/agent/run`)
- Мини-курс в `/course.html`

## Быстрый старт
```bash
cd miniapp-ai-sandbox
cp .env.example .env
npm install
npm run start
```

## Настройка
В `.env`:
- `TELEGRAM_BOT_TOKEN` — токен из BotFather
- `PUBLIC_BASE_URL` — публичный URL (например, через VPS/ngrok)
- `PORT` — порт сервера
- `OPENAI_API_KEY` — опционально (в MVP используется mock-режим)

## Команды бота
- `/start` — открыть конструктор мини-аппов
- `/course` — открыть мини-курс

## Что улучшить следующим шагом
1. Подключить реальный SDK OpenAI/Anthropic в `src/agent.js`
2. Добавить авторизацию и БД (Postgres)
3. Экспорт/импорт шаблонов мини-аппов
4. Добавить библиотеку готовых сценариев
