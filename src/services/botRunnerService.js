/**
 * Bot Runner — обрабатывает входящие обновления для созданных пользователями ботов.
 * Использует сценарий + OpenRouter/Gemini для генерации ответов.
 */

const RUNNER_PREAMBLE = `You are a Telegram bot running according to the following scenario.
Respond naturally and helpfully based on the scenario.
Keep responses concise and formatted for Telegram (use markdown sparingly).
Always respond in the same language the user writes in.`;

export async function handleUpdate(bot, update) {
  const message = update.message;
  if (!message?.text) return;

  const chatId = message.chat.id;
  const userText = message.text;
  const scenario = bot.scenario;

  const systemPrompt = `${RUNNER_PREAMBLE}\n\n---\nBOT SCENARIO:\n${scenario}\n---`;

  let replyText;

  if (process.env.OPENROUTER_API_KEY) {
    replyText = await callOpenRouter({ systemPrompt, userText, model: (process.env.OPENROUTER_MODEL || 'minimax/minimax-m2.7').trim() });
  } else if (process.env.GEMINI_API_KEY) {
    replyText = await callGemini({ systemPrompt, userText });
  } else {
    replyText = `[Mock] Received: ${userText}`;
  }

  await sendTelegramMessage(bot.token, chatId, replyText);
}

async function callOpenRouter({ systemPrompt, userText, model }) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText },
      ],
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '...';
}

async function callGemini({ systemPrompt, userText }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: { maxOutputTokens: 1024 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '...';
}

async function sendTelegramMessage(token, chatId, text) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
}
