export async function runAgent({ prompt, blocks }) {
  const context = blocks
    .map((b, i) => `${i + 1}. [${b.type}] ${b.value}`)
    .join('\n');

  // MVP: mock mode if no external key configured
  if (!process.env.OPENAI_API_KEY) {
    return {
      mode: 'mock',
      text: `AI ответ (mock): Я получил задачу «${prompt}».\\nКонтекст из конструктора:\\n${context || 'пусто'}`
    };
  }

  // Here you can connect OpenAI/Anthropic SDK.
  return {
    mode: 'stub',
    text: 'Подключи SDK OpenAI/Anthropic в src/agent.js для боевого режима.'
  };
}
