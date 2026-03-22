/**
 * Deploy service — деплоит сгенерированного бота на VPS через SSH.
 * Стек на сервере: Node.js + PM2
 */
import { Client } from 'ssh2';

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = (process.env.OPENROUTER_MODEL || 'deepseek/deepseek-chat').trim();

/** Генерирует код бота на основе сценария */
function generateBotCode(botToken, scenario) {
  return `
import fetch from 'node-fetch';
import TelegramBot from 'node-telegram-bot-api';

const bot = new TelegramBot('${botToken}', { polling: true });
const SCENARIO = ${JSON.stringify(scenario)};
const OPENROUTER_KEY = '${OPENROUTER_KEY}';
const MODEL = '${OPENROUTER_MODEL}';

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || '';
  if (!text) return;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': \`Bearer \${OPENROUTER_KEY}\`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SCENARIO },
          { role: 'user', content: text }
        ],
        max_tokens: 1024
      })
    });
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || 'Ошибка ответа AI';
    await bot.sendMessage(chatId, reply);
  } catch (err) {
    await bot.sendMessage(chatId, '⚠️ Ошибка. Попробуйте позже.');
  }
});

console.log('Bot started');
`.trim();
}

function generatePackageJson(botId) {
  return JSON.stringify({
    name: `bot-${botId}`,
    version: '1.0.0',
    type: 'module',
    main: 'index.js',
    dependencies: {
      'node-telegram-bot-api': '^0.66.0',
      'node-fetch': '^3.3.2'
    }
  }, null, 2);
}

/** Выполняет команды на сервере через SSH */
function runSSH(host, password, commands, onLog) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    const log = (msg) => onLog?.(msg);

    conn.on('ready', () => {
      log('✅ SSH подключён');
      let idx = 0;

      function runNext() {
        if (idx >= commands.length) {
          conn.end();
          resolve();
          return;
        }
        const cmd = commands[idx++];
        if (cmd.type === 'exec') {
          log(`⚙️ ${cmd.label || cmd.cmd}`);
          conn.exec(cmd.cmd, (err, stream) => {
            if (err) { conn.end(); reject(err); return; }
            let out = '';
            stream.on('data', d => { out += d; });
            stream.stderr.on('data', d => { out += d; });
            stream.on('close', (code) => {
              if (code !== 0 && cmd.required !== false) {
                conn.end();
                reject(new Error(`Команда завершилась с кодом ${code}: ${out.slice(-300)}`));
              } else {
                runNext();
              }
            });
          });
        } else if (cmd.type === 'write') {
          log(`📝 Записываю ${cmd.path}`);
          const escaped = cmd.content.replace(/\\/g, '\\\\').replace(/'/g, "'\\''");
          conn.exec(`cat > '${cmd.path}' << 'EOFILE'\n${cmd.content}\nEOFILE`, (err, stream) => {
            if (err) { conn.end(); reject(err); return; }
            stream.on('close', () => runNext());
          });
        }
      }
      runNext();
    });

    conn.on('error', reject);

    conn.connect({
      host,
      port: 22,
      username: 'root',
      password,
      readyTimeout: 20000,
    });
  });
}

/** Основная функция деплоя */
export async function deployBot({ host, password, botId, botToken, scenario }, onLog) {
  const dir = `/opt/promptcraft/${botId}`;
  const log = (msg) => { console.log(msg); onLog?.(msg); };

  const botCode = generateBotCode(botToken, scenario);
  const pkgJson = generatePackageJson(botId);

  const commands = [
    { type: 'exec', label: 'Обновляю пакеты', cmd: 'apt-get update -y', required: false },
    { type: 'exec', label: 'Устанавливаю Node.js', cmd: 'curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs', required: false },
    { type: 'exec', label: 'Устанавливаю PM2', cmd: 'npm install -g pm2', required: false },
    { type: 'exec', label: 'Создаю директорию', cmd: `mkdir -p ${dir}` },
    { type: 'write', path: `${dir}/index.js`, content: botCode },
    { type: 'write', path: `${dir}/package.json`, content: pkgJson },
    { type: 'exec', label: 'Устанавливаю зависимости', cmd: `cd ${dir} && npm install --production` },
    { type: 'exec', label: 'Останавливаю старый процесс', cmd: `pm2 delete ${botId}`, required: false },
    { type: 'exec', label: 'Запускаю бота', cmd: `cd ${dir} && pm2 start index.js --name ${botId}` },
    { type: 'exec', label: 'Сохраняю PM2', cmd: 'pm2 save', required: false },
  ];

  await runSSH(host, password, commands, log);
  log('🚀 Бот успешно задеплоен!');
}
