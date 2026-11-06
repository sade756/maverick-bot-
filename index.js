const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const config = require('./config');

console.log(`\n👑 ${config.botName} - ${config.version} Starting...`);

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(config.sessionFolder);
  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    browser: [config.botName, 'Chrome', '1.0']
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      console.log(`✅ ${config.botName} Connected!`);
      await sock.sendMessage(sock.user.id, { text: `*${config.botName} ONLINE*\n${config.version}\n\n👑 Premium Retire Design Active\nPrefix: ${config.prefix}\n\nType ${config.prefix}menu` });
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;
    const from = msg.key.remoteJid;
    const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    if (!body.startsWith(config.prefix)) return;
    const args = body.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const cmdPath = path.join(__dirname, 'commands', `${command}.js`);
    if (fs.existsSync(cmdPath)) {
      try { const cmd = require(cmdPath); await cmd(sock, msg, args, from, config); } catch (e) { console.log(e); }
    }
    if (command === 'menu') {
      const design = `╭━━━〘 *${config.botName}* 〙━━━╮\n┃ 👑 ${config.version}\n┃ Prefix: ${config.prefix}\n╰━━━━━━━━━━━━━━━━━╯\n\n`;
      const files = fs.readdirSync('./commands');
      const list = files.map(f => `│ ▸ ${config.prefix}${f.replace('.js','')}`).join('\n');
      const footer = `\n╰─ Total: ${files.length} cmds`;
      await sock.sendMessage(from, { text: design + list + footer }, { quoted: msg });
    }
  });
}
startBot();
