/**
 * Agent service — runs AI agent against a set of blocks.
 *
 * Priority:
 *   1. GEMINI_API_KEY → Google Gemini (gemini-2.0-flash)
 *   2. No key         → mock mode (returns echo of config)
 */
import { GoogleGenerativeAI } from '@google/generative-ai';

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

  // --- Gemini ---
  if (process.env.GEMINI_API_KEY) {
    return runGemini({ userMessage });
  }

  // --- Mock mode ---
  return {
    mode: 'mock',
    text: `[MOCK — задай GEMINI_API_KEY для настоящего AI]\n\nЗапрос: ${prompt}\n${context || '(блоков нет)'}`,
  };
}

async function runGemini({ userMessage }) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    systemInstruction: SYSTEM_PREAMBLE,
  });

  const result = await model.generateContent(userMessage);
  const text = result.response.text();

  return { mode: 'gemini', text };
}
