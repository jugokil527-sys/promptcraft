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

  if (process.env.GEMINI_API_KEY) {
    return runGemini({ userMessage });
  }

  return {
    mode: 'mock',
    text: `[MOCK — задай GEMINI_API_KEY для настоящего AI]\n\nЗапрос: ${prompt}\n${context || '(блоков нет)'}`,
  };
}

async function runGemini({ userMessage }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelName = process.env.GEMINI_MODEL || MODELS[0];

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM_PREAMBLE }] },
    contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
  });

  // Try v1 then v1beta
  const bases = [
    `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent`,
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
  ];

  let lastErr;
  for (const url of bases) {
    try {
      const res = await fetch(`${url}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`${res.status}: ${err}`);
      }
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return { mode: 'gemini', model: modelName, text };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}
