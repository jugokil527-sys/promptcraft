/**
 * Agent service — runs AI agent against a set of blocks.
 *
 * Priority:
 *   1. GEMINI_API_KEY → Google Gemini REST API
 *   2. No key         → mock mode (returns echo of config)
 */

const SYSTEM_PREAMBLE = `You are an AI-powered mini-app builder assistant.
The user is constructing a Telegram Mini App using a visual block editor.
Each block has a type and value:
- INPUT: data that the end-user of the mini-app will provide at runtime
- PROMPT: the core instruction that drives what the mini-app does
- RULE: constraints, style, or behaviour boundaries
- OUTPUT: the expected format / shape of the result

Your job: take these blocks and the user's request, then generate a working result —
this could be a bot scenario, an app config, generated content, code, or any artefact
the user is building. Be concise, practical, output in the language the user writes in.`;

const MODELS = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
];

function buildContext(blocks) {
  if (!blocks.length) return '';
  const lines = blocks.map((b, i) => `${i + 1}. [${b.type.toUpperCase()}] ${b.value}`);
  return `\nMini-app block configuration:\n${lines.join('\n')}\n`;
}

export async function runAgent({ prompt, blocks = [] }) {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('prompt is required');
  }

  const context = buildContext(blocks);
  const userMessage = context
    ? `${context}\n---\nUser request: ${prompt}`
    : prompt;

  if (process.env.OPENROUTER_API_KEY) {
    return runOpenRouter({ userMessage });
  }

  if (process.env.GEMINI_API_KEY) {
    return runGemini({ userMessage });
  }

  return {
    mode: 'mock',
    text: `[MOCK — задай OPENROUTER_API_KEY для настоящего AI]\n\nЗапрос: ${prompt}\n${context || '(блоков нет)'}`,
  };
}

async function runOpenRouter({ userMessage }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = (process.env.OPENROUTER_MODEL || 'minimax/minimax-m2.7').trim();

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://promptcraft-production-2182.up.railway.app',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PREAMBLE },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  return { mode: 'openrouter', model, text };
}

async function runGemini({ userMessage }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || MODELS[0];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PREAMBLE }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
      }),
    }
  );

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return { mode: 'gemini', model: modelName, text };
}
