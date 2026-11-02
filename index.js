const {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  downloadMediaMessage,
  getContentType,
} = require('baileys');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const pino = require('pino');
const fs = require('fs');
const config = require('./config');
const { imageToSticker } = require('./lib/sticker');
const { parseFormData, ACK } = require('./lib/lobbyForm');

const SETTINGS_FILE = 'settings.json';
const defaultSettings = {
  welcomeText: config.welcomeText,
  goodbyeText: config.goodbyeText,
  lobbyForm: config.lobbyForm,
  antilink: config.groupSettings.antilink,
  welcome: config.groupSettings.welcome,
  goodbye: config.groupSettings.goodbye,
  antispam: config.groupSettings.antispam,
  allowedUsers: [],
  allowedChats: [],
  chats: {},
  pendingLobby: {},
};

let settings = defaultSettings;

const loadSettings = () => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      settings = { ...defaultSettings, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) };
    }
  } catch (err) {
    console.error('No se pudo leer settings.json:', err.message);
  }
};

const saveSettings = () => {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('No se pudo guardar settings.json:', err.message);
  }
};

loadSettings();

const ECON_FILE = 'economy.json';
let econ = { users: {} };

const loadEcon = () => {
  try {
    if (fs.existsSync(ECON_FILE)) {
      econ = { users: {}, ...JSON.parse(fs.readFileSync(ECON_FILE, 'utf8')) };
    }
  } catch (err) {
    console.error('No se pudo leer economy.json:', err.message);
  }
};

const saveEcon = () => {
  try {
    fs.writeFileSync(ECON_FILE, JSON.stringify(econ, null, 2));
  } catch (err) {
    console.error('No se pudo guardar economy.json:', err.message);
  }
};

loadEcon();
if (!econ.names) econ.names = {};

const econUser = (id) => {
  if (!econ.users[id]) econ.users[id] = { cash: 0, bank: 0, cd: {}, dailyStreak: 0 };
  const u = econ.users[id];
  if (!u.cd) u.cd = {};
  if (typeof u.cash !== 'number') u.cash = 0;
  if (typeof u.bank !== 'number') u.bank = 0;
  if (typeof u.dailyStreak !== 'number') u.dailyStreak = 0;
  return u;
};

const money = (n) => '¥' + Number(n).toLocaleString('en-US') + ' Coins';
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const fmtDur = (ms) => {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
};

const fmtMS = (ms) => {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')} m ${String(s).padStart(2, '0')} s`;
};

const fmtCooldownMsg = (ms, cmd) => {
  const total = Math.ceil(ms / 1000);
  let t;
  if (total < 60) {
    t = `${total} segundo${total === 1 ? '' : 's'}`;
  } else if (total < 3600) {
    const m = Math.floor(total / 60);
    t = `${m} minuto${m === 1 ? '' : 's'}`;
  } else {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    t = m > 0 ? `${h} hora${h === 1 ? '' : 's'} ${m} minuto${m === 1 ? '' : 's'}` : `${h} hora${h === 1 ? '' : 's'}`;
  }
  return `《✧》 Debes esperar *${t}* para usar #${cmd} de nuevo.`;
};

const cdLeft = (u, cmd, ms) => Math.max(0, (u.cd[cmd] || 0) + ms - Date.now());
const cdSet = (u, cmd) => {
  u.cd[cmd] = Date.now();
};

const displayName = (num) => {
  const n = econ.names && econ.names[num];
  if (!n) return 'Usuario';
  return String(n).replace(/\n/g, ' ').slice(0, 30);
};

const getTargetUser = (ctx) => {
  if (ctx.mentionedJid && ctx.mentionedJid.length) return jidNum(ctx.mentionedJid[0]);
  if (ctx.quoted && ctx.quoted.participantJid) return jidNum(ctx.quoted.participantJid);
  const args = ctx.text.slice(config.prefix.length).trim().split(/\s+/).slice(1);
  for (const a of args) {
    const d = a.replace('@', '').replace(/\D/g, '');
    if (d.length >= 7) return d;
  }
  return null;
};

const WORK_JOBS = [
  'Trabajas como cortador de galletas y ganas',
  'Cuidaste el grupo cuando los admins no estaban, el pago fue',
  'Trabajaste para una empresa militar privada, ganando',
  'Organizaste un evento de cata de vinos y obtuviste',
  'Moderaste el grupo cuando nadie más estaba, el pago fue',
  'Ibas caminando por la calle y te encuentras con',
  'Te secuestraron y luchaste contra monstruos en un coliseo subterráneo. Ganas',
  'Limpiaste la chimenea y encuentras',
  'Por qué este comando se llama trabajo? Ni siquiera hiciste nada relacionado. Sin embargo, ganas',
  'Trabajaste horas extras en la oficina por',
  'Alguien representó una obra de teatro y por mirar te dieron',
  'Compraste y vendiste artículos y ganaste',
  'Trabajaste en el restaurante de la abuela como cocinero y ganaste',
  'Trabajaste 10 minutos en un local de pizza. Ganaste',
  'Ves a alguien luchando por subir una caja a su auto y ayudas. Amablemente te dan',
  'Ganaste un concurso de comer chili picante. El premio es',
  'Creaste un juego lleno de microtransacciones y ganaste',
  'Trabajaste como podador de arbustos y ganaste',
  'Hiciste trabajo social por una buena causa. Recibiste',
  'Andres te dono. jaja fking pobre',
  'Nadie te hizo caso en el trabajo pero igual te pagaron',
  'Trabajaste gratis media hora por olvidar pedir aumento. Al final te dieron',
  'Vendiste tu vieja consola y ganaste',
  'Le hiciste mandados a tu mamá y te pagó',
  'Hiciste el trabajo de tu compañero y él se llevó el crédito. De lástima te dieron',
  'Atendiste el turno de la mañana en la panadería y ganaste',
  'Diste una clase particular de matemáticas y te pagaron',
  'Repartiste periódicos antes de las 6 AM y ganaste',
  'Ayudaste a cargar muebles en una mudanza y te dieron',
  'Hiciste un turno extra en el hospital y te pagaron',
  'Adriana te premio top migajero/a alch valorate',
];

const SLUT_WIN = [
  'Hoy te sonrió la suerte. Ganaste',
  'Un desconocido generoso te dio',
  'Vendiste algo que ya no usabas. Obtuviste',
  'Ganaste una apuesta amistosa. Recibiste',
  'Te pagaron un favor con',
];

const SLUT_FAIL = [
  '¡Te agarraron! Perdiste',
  'Te denunciaron y pagaste una multa de',
  'Resultó ser un plan de la policía. Perdiste',
  'Te confesaste con el oficial equivocado. Perdiste',
  'apostaste todo a que andres volviera y perdiste',
];

const CRIME_WIN = [
  'Robaste un banco y obtuviste',
  'Negociaste con el jefe de la mafia y obtuviste',
  'Casi te atrapa la policía pero lograste robar una cantidad valiosa. Obtuviste',
  'Los mafiosos te han pagado',
  'Entraste sigilosamente al museo y robaste una obra de arte valiosa. Obtuviste',
  'Te convertiste en el ladrón más buscado del país. Obtuviste',
  'Robaste un camión lleno de productos valiosos y obtuviste',
  'Asaltaste un tren y conseguiste',
  'Secuestraste a un empresario y conseguiste un rescate de',
  'Sobornaste a un oficial de policía para conseguir información valiosa. Obtuviste',
];

const CRIME_FAIL = [
  'LA POLICIA TE VIO 🚔 PERDISTE',
  'Te resbalaste corriendo y perdiste',
  'El dueño era experto en artes marciales. Perdiste',
  'Le robaste a un policía de civil sin darte cuenta. Perdiste',
  'Un ciudadano te inmovilizó hasta que llegó la policía. Perdiste',
];

const logger = pino({ level: 'silent' });
let sock = null;
let _ready = false;
let _lastClientEvent = Date.now();

const jidNum = (jid) => String(jid || '').split('@')[0].split(':')[0].replace(/\D/g, '');
const asJid = (numOrJid) => {
  const s = String(numOrJid || '');
  if (!s) return '';
  return s.includes('@') ? s.split(':')[0] + '@' + s.split('@')[1] : `${s}@s.whatsapp.net`;
};
const jidNorm = (j) => asJid(j);
const isGroupJid = (j) => typeof j === 'string' && j.endsWith('@g.us');
const isSelfJid = (j) => {
  if (!j || !sock || !sock.user) return false;
  const n = jidNorm(j);
  return n === jidNorm(sock.user.id) || (!!sock.user.lid && n === jidNorm(sock.user.lid));
};

const metaCache = new Map();
const getMeta = async (jid) => {
  const c = metaCache.get(jid);
  if (c && Date.now() - c.t < 60000) return c.m;
  const m = await sock.groupMetadata(jid);
  metaCache.set(jid, { m, t: Date.now() });
  try {
    let changed = false;
    for (const p of m.participants || []) {
      const n = jidNum(p.id);
      if (p.notify && n && econ.names[n] !== p.notify) {
        econ.names[n] = p.notify;
        changed = true;
      }
    }
    if (changed) saveEcon();
  } catch (e) {}
  return m;
};

const buildCtx = (m) => {
  const jid = m.key.remoteJid;
  const msg = m.message || {};
  const type = getContentType(msg) || '';
  const content = msg[type] && typeof msg[type] === 'object' ? msg[type] : {};
  const text =
    typeof content.text === 'string'
      ? content.text
      : typeof content.caption === 'string'
        ? content.caption
        : type === 'conversation' && typeof msg.conversation === 'string'
          ? msg.conversation
          : '';
  const contextInfo = content.contextInfo || {};
  const quotedMessage = contextInfo.quotedMessage || null;
  const senderJid = m.key.fromMe
    ? sock.user.id
    : m.key.participant || m.key.remoteJid;
  return {
    m,
    jid,
    text,
    type,
    fromMe: !!m.key.fromMe,
    isGroup: isGroupJid(jid),
    senderJid,
    senderNum: jidNum(senderJid),
    mentionedJid: Array.isArray(contextInfo.mentionedJid) ? contextInfo.mentionedJid : [],
    quoted: quotedMessage
      ? {
          message: quotedMessage,
          participantJid: contextInfo.participant || null,
          stanzaId: contextInfo.stanzaId || null,
        }
      : null,
  };
};

const reply = (ctx, text, mentions) =>
  sock.sendMessage(ctx.jid, { text, mentions: mentions || [] }, { quoted: ctx.m });

const sendTo = (jid, text, mentions) => sock.sendMessage(jid, { text, mentions: mentions || [] });

const getSenderId = (ctx) => (ctx.fromMe ? config.ownerNumber : ctx.senderNum);

const isOwner = (ctx) => getSenderId(ctx) === config.ownerNumber;

const hasPermission = (ctx) => {
  if (isOwner(ctx)) return true;
  return (settings.allowedUsers || []).includes(ctx.senderNum);
};

const isGroupAdmin = async (ctx) => {
  if (ctx.fromMe || isSelfJid(ctx.senderJid)) {
    try {
      const meta = await getMeta(ctx.jid);
      const me = meta.participants.find((p) => isSelfJid(p.id));
      return !!(me && me.admin);
    } catch (e) {
      return false;
    }
  }
  try {
    const meta = await getMeta(ctx.jid);
    const p = meta.participants.find((x) => jidNorm(x.id) === jidNorm(ctx.senderJid));
    return !!(p && p.admin);
  } catch (e) {
    return false;
  }
};

const getTargetFromReply = (ctx) => {
  if (!ctx.quoted) return null;
  const j = ctx.quoted.participantJid || (ctx.isGroup ? null : ctx.jid);
  return jidNum(j) || null;
};

const isChatAllowed = (ctx) => (settings.allowedChats || []).includes(ctx.jid);
const isChatAllowedId = (serialized) => (settings.allowedChats || []).includes(serialized);

const pairHash = (a, b) => {
  const lo = String(Math.min(Number(a) || 0, Number(b) || 0));
  const hi = String(Math.max(Number(a) || 0, Number(b) || 0));
  const s = lo + '|' + hi;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 101;
};

const buildDeck = () => {
  const suits = ['♠️', '♥️', '♦️', '♣️'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = [];
  for (const s of suits) {
    for (const r of ranks) {
      deck.push({ rank: r, suit: s, value: r === 'A' ? 11 : ['J', 'Q', 'K'].includes(r) ? 10 : parseInt(r, 10) });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
};

const cardLabel = (c) => `${c.rank === 'A' ? 'A' : c.value}${c.suit}`;

const handValue = (cards) => {
  let sum = 0;
  let aces = 0;
  for (const c of cards) {
    sum += c.value;
    if (c.rank === 'A') aces++;
  }
  while (sum > 21 && aces > 0) {
    sum -= 10;
    aces--;
  }
  return sum;
};

const formatHand = (cards) => cards.map(cardLabel).join(' ');

const endBlackjack = (me) => {
  const game = globalThis._bj[me];
  const pV = handValue(game.player);
  while (handValue(game.dealer) < 17) game.dealer.push(game.deck.pop());
  const dV = handValue(game.dealer);
  const u = econUser(me);
  const bet = game.bet || 0;
  delete globalThis._bj[me];

  const head = ` *Tú:* ${formatHand(game.player)} = *${pV}*\n\n *Banca:* ${formatHand(game.dealer)} = *${dV}*\n *Apuesta:* *${money(bet)}*`;

  let outcome = '';
  if (dV > 21) {
    u.cash += bet * 2;
    saveEcon();
    outcome = `\n\n ¡La banca se pasó! 🎉 *Ganaste ${money(bet * 2)}.*`;
  } else if (pV > dV) {
    u.cash += bet * 2;
    saveEcon();
    outcome = `\n\n 🎉 *Ganaste ${money(bet * 2)}.*`;
  } else if (pV === dV) {
    u.cash += bet;
    saveEcon();
    outcome = `\n\n 🤝 *Empate.* Te devuelven tu apuesta ${money(bet)}.`;
  } else {
    u.cash = Math.max(0, u.cash - bet);
    saveEcon();
    outcome = `\n\n 😞 *Perdiste ${money(bet)}.*`;
  }

  return `${head}${outcome}`;
};

const getChatSettings = (chatId) => {
  const ov = (settings.chats || {})[chatId] || {};
  return {
    welcome: ov.welcome !== undefined ? ov.welcome : settings.welcome,
    goodbye: ov.goodbye !== undefined ? ov.goodbye : settings.goodbye,
    antilink: ov.antilink !== undefined ? ov.antilink : settings.antilink,
    antispam: ov.antispam !== undefined ? ov.antispam : settings.antispam,
    welcomeText: ov.welcomeText !== undefined ? ov.welcomeText : settings.welcomeText,
    goodbyeText: ov.goodbyeText !== undefined ? ov.goodbyeText : settings.goodbyeText,
    lobby: ov.lobby !== undefined ? ov.lobby : false,
    lobbyForm: ov.lobbyForm !== undefined ? ov.lobbyForm : settings.lobbyForm,
    helpTypes: ov.helpTypes,
  };
};

const setChatFlag = async (ctx, key, value) => {
  const chatId = ctx.jid;
  if (!chatId) return false;
  settings.chats = settings.chats || {};
  settings.chats[chatId] = settings.chats[chatId] || {};
  if (value === undefined) {
    delete settings.chats[chatId][key];
  } else {
    settings.chats[chatId][key] = value;
  }
  saveSettings();
  return true;
};

const formatTemplate = (template, vars) => {
  return String(template)
    .replace(/@user/g, vars.nombres)
    .replace(/#group/g, vars.grupo)
    .replace(/#desc/g, vars.desc)
    .replace(/#members/g, vars.members)
    .replace(/{nombres}/g, vars.nombres)
    .replace(/{grupo}/g, vars.grupo)
    .replace(/{desc}/g, vars.desc)
    .replace(/{members}/g, vars.members);
};

const helpCategories = {
  casino: ['work', 'slut', 'crime', 'daily', 'rob', 'pay', 'bal', 'baltop', 'deposit', 'withdraw', 'give', 'take', 'bj', 'blackjack', 'pedir', 'plantarme', 'ruleta', 'rt', 'medida', 'match', '8ball'],
  group: ['tagall', 'tag', 'tagadmin', 'antilink', 'welcome', 'goodbye', 'setwelcome', 'setgoodbye', 'testwelcome', 'texts', 'lobby', 'setform', 'testlobby', 'seguir', 'bienvenido', 'expulsar'],
  admin: ['perm', 'promote', 'demote', 'setup', 'unlock', 'lock', 'resetdaily'],
  utility: ['help', 'info', 'ping', 'stk'],
};

const helpCategoryLabels = {
  casino: '🎰 Casino, Economía y Juegos',
  group: '👥 Grupo',
  admin: '🛠️ Administración',
  utility: '⚙️ Utilidad',
};

const helpAllCats = Object.keys(helpCategories);

const commands = {
  help: {
    desc: ' Muestra comandos filtrados por categoría de este chat',
    execute: async (ctx) => {
      const prefix = config.prefix;
      const chatSt = getChatSettings(ctx.jid);
      let allowedCats = chatSt.helpTypes;
      if (!allowedCats || allowedCats.length === 0) allowedCats = helpAllCats;

      let helpText = ` 「  ${config.botName}  」\n\n`;
      helpText += `  Comandos disponibles en este chat:\n\n`;

      for (const cat of allowedCats) {
        if (!helpCategories[cat]) continue;
        helpText += `  *${helpCategoryLabels[cat] || cat}*\n`;
        for (const cmd of helpCategories[cat]) {
          const c = commands[cmd];
          if (!c) continue;
          const alias = Object.entries(commandAliases).find(([, v]) => v === cmd);
          const aliasTxt = alias ? ` (alias: #${alias[0]})` : '';
          helpText += `    ${prefix}${cmd}${aliasTxt} - ${c.desc.trim()}\n`;
        }
        helpText += `\n`;
      }

      helpText += `  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

      helpText += `  Para cambiar categorías usá:\n`;
      helpText += `  ${prefix}sethelp <categorías>\n`;
      helpText += `  Categorías: ${helpAllCats.join(', ')}\n`;
      helpText += `  Ej: ${prefix}sethelp casino,economy`;

      return helpText;
    },
  },

  sethelp: {
    desc: ' Configura qué categorías de comandos se muestran en #help (solo admins/owner)',
    execute: async (ctx) => {
      if (!ctx.isGroup) return 'Este comando solo funciona en grupos.';
      if (!(await isGroupAdmin(ctx)) && !isOwner(ctx)) return 'Solo los admins pueden configurar el help de este grupo.';

      const chatId = ctx.jid;
      settings.chats = settings.chats || {};
      settings.chats[chatId] = settings.chats[chatId] || {};
      const currentCats = settings.chats[chatId].helpTypes || helpAllCats;

      const args = ctx.text.slice(config.prefix.length).trim().split(/\s+/).slice(1);
      const arg = args[0] ? args[0].toLowerCase() : '';

      if (!arg) {
        return `📋 *Categorías actuales de #help en este grupo:*\n\n${currentCats.join(', ')}\n\nUsá:\n#sethelp <cat1,cat2,...>  (establecer)\n#sethelp +categoría  (agregar)\n#sethelp -categoría  (quitar)\n#sethelp reset  (volver a todas)\nCategorías: ${helpAllCats.join(', ')}`;
      }

      if (arg === 'reset') {
        settings.chats[chatId].helpTypes = helpAllCats;
        saveSettings();
        return `✅ Se restauraron todas las categorías de #help en este grupo.`;
      }

      let newCats;
      if (arg.startsWith('+')) {
        const cat = arg.slice(1);
        if (!helpAllCats.includes(cat)) return `Categoría inválida: ${cat}. Opciones: ${helpAllCats.join(', ')}`;
        if (currentCats.includes(cat)) return `La categoría ${cat} ya está activa.`;
        newCats = [...currentCats, cat];
      } else if (arg.startsWith('-')) {
        const cat = arg.slice(1);
        if (!helpAllCats.includes(cat)) return `Categoría inválida: ${cat}. Opciones: ${helpAllCats.join(', ')}`;
        if (!currentCats.includes(cat)) return `La categoría ${cat} no está activa.`;
        newCats = currentCats.filter((c) => c !== cat);
        if (newCats.length === 0) return `No podés quitar todas las categorías. Dejá al menos una.`;
      } else {
        const cats = arg.split(',').map((c) => c.trim()).filter(Boolean);
        for (const c of cats) {
          if (!helpAllCats.includes(c)) return `Categoría inválida: ${c}. Opciones: ${helpAllCats.join(', ')}`;
        }
        newCats = cats;
      }

      settings.chats[chatId].helpTypes = newCats;
      saveSettings();
      return `✅ Categorías de #help actualizadas en este grupo:\n\n${newCats.join(', ')}`;
    },
  },

  info: {
    desc: ' Información del bot',
    execute: async () => {
      return `「  ${config.botName}  」\n\n Bot de WhatsApp creado con Baileys\n Versión: 2.0.0\n Propietario: ${econ.names[config.ownerNumber] || 'Propietario'}`;
    },
  },

  tagall: {
    desc: ' Menciona a todos con listado visible',
    execute: async (ctx) => {
      if (!ctx.isGroup) return 'Este comando solo funciona en grupos.';
      const meta = await getMeta(ctx.jid);
      const text = ctx.text.slice(config.prefix.length + 6).trim();
      const emoji = '🔔';
      const header = text ? `*» ${text}*\n\n` : '';
      const ids = meta.participants.map((p) => p.id);
      let response = ` *${emoji}  MENCION GENERAL  ${emoji}*\n *PARA ${meta.participants.length} MIEMBROS*\n\n${header}`;
      meta.participants.forEach((p) => {
        response += `${emoji} @${displayName(jidNum(p.id))}\n`;
      });
      response += `\n *${config.botName}*`;
      await sendTo(ctx.jid, response, ids);
    },
  },

  tag: {
    desc: ' Menciona a todos en silencio (solo admins)',
    execute: async (ctx) => {
      if (!ctx.isGroup) return 'Este comando solo funciona en grupos.';
      if (!(await isGroupAdmin(ctx)) && !isOwner(ctx)) return 'Solo los admins pueden usar este comando.';
      const meta = await getMeta(ctx.jid);
      const text = ctx.text.slice(config.prefix.length + 4).trim();
      const mentions = meta.participants.map((p) => p.id);
      const invisible = '\u200E'.repeat(850);
      const content = text ? `${invisible}\n${text}` : `${invisible}\n*Mención general*`;
      await sendTo(ctx.jid, content, mentions);
    },
  },

  tagadmin: {
    desc: ' Menciona a los administradores del grupo',
    execute: async (ctx) => {
      if (!ctx.isGroup) return 'Este comando solo funciona en grupos.';
      const meta = await getMeta(ctx.jid);
      const admins = meta.participants.filter((p) => p.admin);
      const ids = admins.map((p) => p.id);
      const lines = admins.map((p) => `@${displayName(jidNum(p.id))}`).join('\n');
      await sendTo(ctx.jid, ` *Administradores:*\n\n${lines}`, ids);
    },
  },

  stk: {
    desc: ' Convierte una imagen en sticker (responde a una imagen)',
    execute: async (ctx) => {
      if (!ctx.quoted) {
        return 'Debes responder a una imagen para convertirla en sticker.';
      }
      const qType = getContentType(ctx.quoted.message) || '';
      if (qType !== 'imageMessage') {
        return 'Debes responder a una imagen para convertirla en sticker.';
      }
      try {
        const buf = await downloadMediaMessage(
          {
            key: {
              remoteJid: ctx.jid,
              id: ctx.quoted.stanzaId,
              participant: ctx.quoted.participantJid,
            },
            message: ctx.quoted.message,
          },
          'buffer',
          {},
          { logger, reuploadRequest: sock.updateMediaMessage }
        );
        const webp = await imageToSticker(buf);
        return { type: 'sticker', buffer: webp };
      } catch (e) {
        console.error('Error convirtiendo sticker:', e.message);
        return 'No se pudo convertir la imagen en sticker.';
      }
    },
  },

  antilink: {
    desc: ' Activa/desactiva el anti-links',
    execute: async (ctx) => {
      if (!(await isGroupAdmin(ctx)) && !isOwner(ctx)) return 'Solo los admins pueden usar este comando.';
      const arg = ctx.text.slice(config.prefix.length + 8).trim().toLowerCase();
      if (arg === 'on') {
        await setChatFlag(ctx, 'antilink', true);
        return 'Anti-links *activado* ✓ en este grupo';
      } else if (arg === 'off') {
        await setChatFlag(ctx, 'antilink', false);
        return 'Anti-links *desactivado* ✗ en este grupo';
      }
      return `Uso: ${config.prefix}antilink on/off`;
    },
  },

  antispam: {
    desc: ' Activa/desactiva el anti-spam',
    execute: async (ctx) => {
      if (!(await isGroupAdmin(ctx)) && !isOwner(ctx)) return 'Solo los admins pueden usar este comando.';
      const arg = ctx.text.slice(config.prefix.length + 8).trim().toLowerCase();
      if (arg === 'on') {
        await setChatFlag(ctx, 'antispam', true);
        return 'Anti-spam *activado* ✓ en este grupo';
      } else if (arg === 'off') {
        await setChatFlag(ctx, 'antispam', false);
        return 'Anti-spam *desactivado* ✗ en este grupo';
      }
      return `Uso: ${config.prefix}antispam on/off`;
    },
  },

  welcome: {
    desc: ' Activa/desactiva el mensaje de bienvenida',
    execute: async (ctx) => {
      if (!(await isGroupAdmin(ctx)) && !isOwner(ctx)) return 'Solo los admins pueden usar este comando.';
      const arg = ctx.text.slice(config.prefix.length + 8).trim().toLowerCase();
      if (arg === 'on') {
        await setChatFlag(ctx, 'welcome', true);
        return 'Bienvenida *activada* ✓ en este grupo';
      } else if (arg === 'off') {
        await setChatFlag(ctx, 'welcome', false);
        return 'Bienvenida *desactivada* ✗ en este grupo';
      }
      return `Uso: ${config.prefix}welcome on/off`;
    },
  },

  goodbye: {
    desc: ' Activa/desactiva la despedida',
    execute: async (ctx) => {
      if (!(await isGroupAdmin(ctx)) && !isOwner(ctx)) return 'Solo los admins pueden usar este comando.';
      const arg = ctx.text.slice(config.prefix.length + 7).trim().toLowerCase();
      if (arg === 'on') {
        await setChatFlag(ctx, 'goodbye', true);
        return 'Despedida *activada* ✓ en este grupo';
      } else if (arg === 'off') {
        await setChatFlag(ctx, 'goodbye', false);
        return 'Despedida *desactivada* ✗ en este grupo';
      }
      return `Uso: ${config.prefix}goodbye on/off`;
    },
  },

  lobby: {
    desc: ' Activa/desactiva el modo lobby de ESTE grupo',
    execute: async (ctx) => {
      if (!(await isGroupAdmin(ctx)) && !isOwner(ctx)) return 'Solo los admins pueden usar este comando.';
      const arg = ctx.text.slice(config.prefix.length + 6).trim().toLowerCase();
      if (arg === 'on') {
        await setChatFlag(ctx, 'lobby', true);
        return 'Lobby *iniciado* ✓ En este grupo se mandará el formulario a cada persona que entre.';
      }
      if (arg === 'off') {
        await setChatFlag(ctx, 'lobby', false);
        return 'Lobby *detenido* ✗ en este grupo.';
      }
      return `Uso: ${config.prefix}lobby on/off`;
    },
  },

  setform: {
    desc: ' Configura el formulario del lobby en este grupo',
    execute: async (ctx) => {
      if (!(await isGroupAdmin(ctx)) && !isOwner(ctx)) return 'Solo los admins pueden usar este comando.';
      const newForm = ctx.text.slice(config.prefix.length + 8).trim();
      const actual = getChatSettings(ctx.jid).lobbyForm;
      if (!newForm) {
        return `Uso: ${config.prefix}setform <formulario>\n   O ${config.prefix}setform reset (volver al formulario global)\n\nFormulario actual (este grupo):\n${actual}`;
      }
      if (newForm.toLowerCase() === 'reset') {
        await setChatFlag(ctx, 'lobbyForm', undefined);
        return 'Formulario de este grupo *reiniciado* ✓ (usa el global)';
      }
      await setChatFlag(ctx, 'lobbyForm', newForm);
      return 'Formulario del lobby *guardado* ✓ (solo para este grupo)';
    },
  },

  testlobby: {
    desc: ' Prueba el flujo del lobby: te registra como tester y te manda el formulario',
    execute: async (ctx) => {
      if (!ctx.isGroup) return 'Este comando solo funciona en grupos.';
      const key = ctx.jid;
      const sender = getSenderId(ctx);
      settings.pendingLobby = settings.pendingLobby || {};
      settings.pendingLobby[key] = settings.pendingLobby[key] || [];
      const list = settings.pendingLobby[key];
      const idx = list.findIndex((p) => p && p.n === sender);
      if (idx !== -1 && !list[idx].test) {
        return 'Ya tenés una solicitud en curso en este grupo. Terminá esa antes de probar.';
      }
      const entry = { n: sender, stage: 'form', record: null, nombre: null, test: true };
      if (idx === -1) {
        list.push(entry);
      } else {
        list[idx] = entry;
      }
      saveSettings();
      const st = getChatSettings(key);
      await sendTo(ctx.jid, '\u200E🧪 *PRUEBA DEL LOBBY*\n\nCompletá el formulario como lo haría una persona que entra (un dato por línea):\n\n' + st.lobbyForm);
    },
  },

  seguir: {
    desc: ' Avanza/reinicia el lobby de un usuario (admins) - uso: #seguir @usuario o #seguir reset @usuario',
    execute: async (ctx) => {
      if (!(await isGroupAdmin(ctx)) && !isOwner(ctx)) return 'Solo los admins pueden usar este comando.';
      if (!ctx.isGroup) return 'Solo funciona en grupos.';
      const key = ctx.jid;
      const args = ctx.text.slice(config.prefix.length + 6).trim().split(/\s+/);
      const action = args[0]?.toLowerCase();
      let num = null;
      if (ctx.mentionedJid.length) {
        num = jidNum(ctx.mentionedJid[0]);
      } else if (args[1]) {
        num = args[1].replace(/\D/g, '');
      }
      if (!num) return `Uso: ${config.prefix}seguir @usuario\n   ${config.prefix}seguir reset @usuario (reinicia desde formulario)`;
      settings.pendingLobby = settings.pendingLobby || {};
      const list = settings.pendingLobby[key] || [];
      const idx = list.findIndex((p) => (typeof p === 'string' ? p : p.n) === num);
      if (idx === -1) return 'Esa persona no está en el lobby de este grupo.';
      if (action === 'reset') {
        list.splice(idx, 1);
        saveSettings();
        return `✅ Lobby *reiniciado* para @${displayName(num)}. Se le mandará el formulario de nuevo al entrar.`;
      }
      const entry = list[idx];
      if (entry.stage === 'form') {
        entry.stage = 'iniciales';
        entry.record = '* Reclutado por: —\n* Nombre: —\n* Edad: —\n* Roblox: —\n* País: —\n* Pronombres: —\n* Vienes de otro clan: no\n* Iniciales DKS: pendiente';
        entry.nombre = 'amigo/a';
      } else if (entry.stage === 'otro_clan') {
        entry.stage = 'iniciales';
      } else if (entry.stage === 'clan_detalle') {
        entry.stage = 'iniciales';
      } else if (entry.stage === 'confirm') {
        entry.stage = 'iniciales';
      }
      saveSettings();
      await reply(ctx, `\u200E✅ Lobby *avanzado* para @${displayName(num)}. Etapa actual: *${entry.stage}*.`);
    },
  },

  setmain: {
    desc: ' Marca ESTE grupo como el grupo principal (rotación de link)',
    execute: async (ctx) => {
      if (!ctx.isGroup) return 'Este comando solo funciona en grupos.';
      if (!(await isGroupAdmin(ctx)) && !isOwner(ctx)) return 'Solo los admins pueden usar este comando.';
      settings.mainGroupId = ctx.jid;
      saveSettings();
      let link = null;
      try {
        link = await getMainInviteLink();
      } catch (e) {
        console.error('Error obteniendo link:', e.message);
      }
      const meta = await getMeta(ctx.jid);
      return (
        `Grupo principal *configurado* ✓ (${meta.subject})\n\n` +
        (link ? `El link actual del grupo es:\n${link}\n\n` : '') +
        'Desde ahora, cada vez que alguien entre por el link, el bot lo regenera automáticamente.'
      );
    },
  },

  bienvenido: {
    desc: ' Aprueba manualmente a alguien del lobby y le envía el link',
    execute: async (ctx) => {
      if (!ctx.isGroup) return 'Este comando solo funciona en grupos.';
      if (!(await isGroupAdmin(ctx)) && !isOwner(ctx)) return 'Solo los admins pueden usar este comando.';
      let num = null;
      if (ctx.mentionedJid.length) {
        num = jidNum(ctx.mentionedJid[0]);
      } else {
        num = getTargetFromReply(ctx);
      }
      if (!num) return `Uso: ${config.prefix}bienvenido @usuario\n   (o respondé al mensaje de la persona)`;

      const key = ctx.jid;
      settings.pendingLobby = settings.pendingLobby || {};
      const entry = findPending(key, num);
      if (!entry) return 'Esa persona no está pendiente en el lobby de este grupo.';

      if (entry.nombre) entry.stage = 'sent';
      saveSettings();

      const link = await getMainInviteLink();
      if (!link) {
        await reply(ctx, '⚠️ El link del grupo principal aún no está configurado.');
        return;
      }
      await sendTo(
        ctx.jid,
        `\u200E🎉 ¡Entrada *confirmada*, ${entry.nombre || 'bienvenido/a a DKS'}!\n\n👉 Únete al grupo principal con este enlace:\n${link}\n\nCuando te unas, este bot te saca del lobby. ✨`
      );
      await rotateMainInvite();
      return entry.nombre
        ? `Listo ✓ Le envié el link a *${entry.nombre}*.`
        : 'Listo ✓ Link enviado en el grupo.';
    },
  },

  expulsar: {
    desc: ' Expulsa a alguien de TODOS los grupos donde esté (admins)',
    execute: async (ctx) => {
      if (!ctx.isGroup) return 'Este comando solo funciona en grupos.';
      if (!(await isGroupAdmin(ctx)) && !isOwner(ctx)) return 'Solo los admins pueden usar este comando.';
      let num = null;
      if (ctx.mentionedJid.length) {
        num = jidNum(ctx.mentionedJid[0]);
      } else {
        num = getTargetFromReply(ctx);
      }
      if (!num) return `Uso: ${config.prefix}expulsar @usuario\n   (o respondé al mensaje de la persona)`;

      const removed = [];
      const failed = [];
      const groups = await sock.groupFetchAllParticipating();
      for (const gid of Object.keys(groups)) {
        const meta = groups[gid];
        const part = (meta.participants || []).find((p) => jidNum(p.id) === num);
        if (!part) continue;
        try {
          await sock.groupParticipantsUpdate(gid, [part.id], 'remove');
          metaCache.delete(gid);
          removed.push(meta.subject || gid);
        } catch (e) {
          failed.push(meta.subject || gid);
        }
      }

      if (settings.pendingLobby) {
        let changed = false;
        for (const key of Object.keys(settings.pendingLobby)) {
          const list = settings.pendingLobby[key];
          const b = list.length;
          const filtered = list.filter((p) => (typeof p === 'string' ? p : p.n) !== num);
          if (filtered.length !== b) {
            settings.pendingLobby[key] = filtered;
            changed = true;
          }
        }
        if (changed) saveSettings();
      }

      if (removed.length === 0 && failed.length === 0) return 'Esa persona no está en ningún grupo con el bot.';
      return `Listo ✓ Expulsado de:\n${removed.map((n) => ` • ${n}`).join('\n')}${failed.length ? `\n\n⚠️ No pude en estos (¿bot es admin?):\n${failed.map((n) => ` • ${n}`).join('\n')}` : ''}`;
    },
  },

  setwelcome: {
    desc: ' Configura el texto de bienvenida de ESTE grupo',
    execute: async (ctx) => {
      if (!(await isGroupAdmin(ctx)) && !isOwner(ctx)) return 'Solo los admins pueden usar este comando.';
      const newText = ctx.text.slice(config.prefix.length + 11).trim();
      const actual = getChatSettings(ctx.jid).welcomeText;
      if (!newText) {
        return `Uso: ${config.prefix}setwelcome <texto>\n   O ${config.prefix}setwelcome reset (volver al texto global)\n\nVariables:\n{nombres} = quien entra\n{grupo} = nombre del grupo\n{desc} = descripción del grupo\n{members} = cantidad de miembros\n\nTexto actual (en este grupo):\n${actual}`;
      }
      if (newText.toLowerCase() === 'reset') {
        await setChatFlag(ctx, 'welcomeText', undefined);
        return 'Bienvenida de este grupo *reiniciada* ✓ (usa el texto global)';
      }
      await setChatFlag(ctx, 'welcomeText', newText);
      return 'Texto de bienvenida *guardado* ✓ (solo para este grupo)';
    },
  },

  setgoodbye: {
    desc: ' Configura el texto de despedida de ESTE grupo',
    execute: async (ctx) => {
      if (!(await isGroupAdmin(ctx)) && !isOwner(ctx)) return 'Solo los admins pueden usar este comando.';
      const newText = ctx.text.slice(config.prefix.length + 11).trim();
      const actual = getChatSettings(ctx.jid).goodbyeText;
      if (!newText) {
        return `Uso: ${config.prefix}setgoodbye <texto>\n   O ${config.prefix}setgoodbye reset (volver al texto global)\n\nVariables:\n{nombres} = quien sale\n{grupo} = nombre del grupo\n{desc} = descripción del grupo\n{members} = cantidad de miembros\n\nTexto actual (en este grupo):\n${actual}`;
      }
      if (newText.toLowerCase() === 'reset') {
        await setChatFlag(ctx, 'goodbyeText', undefined);
        return 'Despedida de este grupo *reiniciada* ✓ (usa el texto global)';
      }
      await setChatFlag(ctx, 'goodbyeText', newText);
      return 'Texto de despedida *guardado* ✓ (solo para este grupo)';
    },
  },

  testwelcome: {
    desc: ' Muestra una vista previa de la bienvenida',
    execute: async (ctx) => {
      if (!ctx.isGroup) return 'Este comando solo funciona en grupos.';
      if (!(await isGroupAdmin(ctx)) && !isOwner(ctx)) return 'Solo los admins pueden usar este comando.';
      const st = getChatSettings(ctx.jid);
      const meta = await getMeta(ctx.jid);
      const ejemplo = formatTemplate(st.welcomeText, {
        nombres: '@nuevo_miembro',
        grupo: meta.subject,
        desc: meta.desc || 'Sin descripción',
        members: meta.participants.length,
      });
      return ` *Vista previa de bienvenida (este grupo):*\n\n${ejemplo}`;
    },
  },

  texts: {
    desc: ' Muestra los textos configurados en este grupo',
    execute: async (ctx) => {
      const st = getChatSettings(ctx.jid);
      return ` *Textos configurados (este grupo):*\n\n• Bienvenida:\n${st.welcomeText}\n\n• Despedida:\n${st.goodbyeText}`;
    },
  },

  ping: {
    desc: ' Verifica si el bot está activo',
    execute: async () => {
      return 'Pong! El bot está funcionando ✓';
    },
  },

  medida: {
    desc: ' Cuánto le mide (?  (diversión)',
    execute: async () => {
      const cm = 6 + Math.floor(Math.random() * 24);
      const comment =
        cm < 10
          ? 'Pobre... 🥲'
          : cm < 15
            ? 'Pasa piola igual 😅'
            : cm < 20
              ? 'Bien ahí 👍'
              : '¡Ufff, máquina! 🔥';
      return ` *Cuánto me mide*\n\n Te mide *${cm} cm*, ${cm < 10 ? 'amigo' : 'compa'}. ${comment}`;
    },
  },

  match: {
    desc: ' Compatibilidad entre 2 personas',
    execute: async (ctx) => {
      let a = null;
      let b = null;
      if (ctx.mentionedJid.length >= 2) {
        a = ctx.mentionedJid[0];
        b = ctx.mentionedJid[1];
      } else if (ctx.mentionedJid.length === 1) {
        a = ctx.fromMe ? config.ownerNumber : ctx.senderJid;
        b = ctx.mentionedJid[0];
      } else if (ctx.quoted) {
        a = ctx.fromMe ? config.ownerNumber : ctx.senderJid;
        b = ctx.quoted.participantJid || ctx.jid;
      }
      if (!a || !b) {
        return `Uso: ${config.prefix}match @usuario\n   (o ${config.prefix}match @usuario1 @usuario2 para comparar dos)\n   (o respondé al mensaje de la persona)`;
      }
      const na = jidNum(a);
      const nb = jidNum(b);
      const pct = pairHash(na, nb);
      let an = displayName(na);
      let bn = displayName(nb);
      try {
        const v = await sock.getName(asJid(a));
        if (v && !/^\+?[\d\s\-()]+$/.test(String(v).trim())) an = String(v).trim().slice(0, 30);
      } catch (e) {}
      try {
        const v = await sock.getName(asJid(b));
        if (v && !/^\+?[\d\s\-()]+$/.test(String(v).trim())) bn = String(v).trim().slice(0, 30);
      } catch (e) {}
      const verdict =
        pct >= 90
          ? '¡Destino! 💍 Te están haciendo las señales del universo.'
          : pct >= 75
            ? '¡Muy compatibles! 💕 Cumplen el hilo.'
            : pct >= 50
              ? 'Hay química 🥰 Falta confianza no más.'
              : pct >= 30
                ? 'Se puede intentar 😅 pero no lo espere mucho.'
                : 'Ufff... mejor amigos 👬';
      return ` 💞 *Match Charizard*\n\n *${an}* + *${bn}*\n\n • Compatibilidad: *${pct}%*\n\n${verdict}`;
    },
  },

  '8ball': {
    desc: ' La bola mágica responde tu pregunta (diversión)',
    execute: async (ctx) => {
      const question = ctx.text.slice(config.prefix.length + 5).trim();
      if (!question) {
        return `Uso: ${config.prefix}8ball <tu pregunta>\n   Ej: ${config.prefix}8ball voy a ganar la próxima?\n\n*Pregunta mágica:* ...escribe una pregunta.`;
      }
      const answers = [
        '🎱 Sí, definitivamente.',
        '🎱 Es seguro que sí.',
        '🎱 Sin dudas.',
        '🎱 Puede ser... pregunta de nuevo.',
        '🎱 Las señales dicen que sí.',
        '🎱 Mejor no te digo ahora.',
        '🎱 No cuentes con eso.',
        '🎱 Mi respuesta es no.',
        '🎱 Muy dudoso.',
        '🎱 Concéntrate y preguntá de nuevo.',
      ];
      const answer = answers[Math.floor(Math.random() * answers.length)];
      return ` 🎱 *Bola Mágica*\n\n *Pregunta:* "${question}"\n\n ${answer}`;
    },
  },

  ruleta: {
    desc: ' Ruleta de casino. Apostá con #ruleta <rojo|negro> <monto> (mínimo 1000). Se abre ronda automáticamente',
    execute: async (ctx) => {
      if (!ctx.isGroup) return 'Este comando solo funciona en grupos.';
      if (!globalThis._ruletaGame) {
        globalThis._ruletaGame = {
          active: false,
          jid: null,
          endTime: 0,
          interval: null,
          bets: new Map(),
          starter: null,
        };
      }
      const g = globalThis._ruletaGame;
      const me = getSenderId(ctx);
      const args = ctx.text.slice(config.prefix.length).trim().split(/\s+/).slice(1);
      const sub = args[0] ? args[0].toLowerCase() : '';

      // Si no pone nada, iniciar ronda automáticamente
      if (!sub) {
        if (g.active) return `Ya hay una ruleta abierta en este grupo. Apostá con: #ruleta <rojo|negro> <monto>`;
        g.active = true;
        g.jid = ctx.jid;
        g.starter = me;
        g.bets = new Map();
        g.endTime = Date.now() + 30 * 1000;

        await sendTo(
          ctx.jid,
          `\u200E🎡 *Ruleta DKS - Ronda abierta!*\n\nApostá con:\n#ruleta rojo <monto>\n#ruleta negro <monto>\n#ruleta red <monto>\n#ruleta black <monto>\nMínimo: *1000 Coins*\n\nTiempo para apostar: *30 segundos*\n¡Buena suerte! 🍀`
        );

        // Avisos cada 7 segundos
        const announce = (left) => {
          if (!g.active) return;
          if (left <= 0) return;
          sendTo(ctx.jid, `\u200E⏳ Quedan *${Math.ceil(left / 1000)}s* para apostar en la ruleta.`).catch(() => {});
        };
        announce(28000);
        announce(21000);
        announce(14000);
        announce(7000);

        g.interval = setTimeout(async () => {
          if (!g.active) return;
          g.active = false;
          clearTimeout(g.interval);
          g.interval = null;

          // Girar ruleta: solo rojo o negro
          const winningNum = Math.floor(Math.random() * 36) + 1; // 1-36
          const redNums = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
          const blackNums = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];
          let winningColor = 'rojo';
          if (redNums.includes(winningNum)) winningColor = 'rojo';
          if (blackNums.includes(winningNum)) winningColor = 'negro';

          const lines = [];
          let totalPayout = 0;
          let totalBets = 0;

          for (const [userId, bet] of g.bets) {
            const u = econUser(userId);
            totalBets += bet.amount;
            let won = false;
            let multiplier = 0;
            if (bet.type === 'color') {
              if (bet.choice === winningColor) {
                won = true;
                multiplier = 2;
              }
            }
            if (won) {
              const payout = bet.amount * multiplier;
              u.cash += payout;
              totalPayout += payout;
              lines.push(`✅ *${displayName(userId)}* apostó ${money(bet.amount)} a *${bet.choice}* y ganó *${money(payout)}* (x${multiplier})`);
            } else {
              u.cash = Math.max(0, u.cash - bet.amount);
              lines.push(`❌ *${displayName(userId)}* apostó ${money(bet.amount)} a *${bet.choice}* y perdió.`);
            }
          }
          saveEcon();

          const colorEmoji = winningColor === 'rojo' ? '🔴' : '⚫';
          let resultMsg = `\u200E🎯 *Ruleta cerrada*\n\nNúmero ganador: ${colorEmoji} *${winningNum}* (${winningColor})\n\n`;
          if (g.bets.size === 0) {
            resultMsg += `Nadie apostó esta ronda.`;
          } else {
            resultMsg += `${lines.join('\n')}\n\nTotal apostado: *${money(totalBets)}*\nTotal pagado: *${money(totalPayout)}*`;
          }
          try {
            await sendTo(ctx.jid, resultMsg);
          } catch (e) {
            console.error('Error enviando resultado ruleta:', e.message);
          } finally {
            g.active = false;
            g.jid = null;
            g.starter = null;
            g.bets = new Map();
            g.interval = null;
          }
        }, 30000);

        return null;
      }

      // Detener ronda anticipadamente (solo starter o admin)
      if (sub === 'stop') {
        if (!g.active) return 'No hay ninguna ruleta activa en este grupo.';
        if (me !== g.starter && !(await isGroupAdmin(ctx)) && !isOwner(ctx)) return 'Solo quien inició la ronda o un admin puede detenerla.';
        clearTimeout(g.interval);
        g.active = false;
        g.interval = null;
        await sendTo(ctx.jid, '\u200E🛑 La ruleta fue detenida anticipadamente. Nadie ganó ni perdió.');
        return null;
      }

      // Apostar solo rojo o negro (acepta red/black como sinónimos)
      // Soporta ambos formatos: #ruleta rojo 1000  y  #ruleta 1000 rojo
      let choice = sub;
      let amountArg = args[1];
      if (choice === 'red') choice = 'rojo';
      if (choice === 'black') choice = 'negro';

      // Si el primer arg es un número, entonces el color está en la segunda posición
      if (/^\d+$/.test(choice)) {
        amountArg = choice;
        choice = args[1];
        if (choice === 'red') choice = 'rojo';
        if (choice === 'black') choice = 'negro';
      }

      if (!choice || !amountArg) {
        return `Uso: #ruleta <rojo|negro> <monto>\n   Ej: #ruleta rojo 1000\n   Ej: #ruleta 1000 rojo\n   Ej: #ruleta red 1000\n   Ej: #ruleta 1000 red\n   Mínimo: *1000 Coins*`;
      }
      if (choice !== 'rojo' && choice !== 'negro') return 'Opción inválida. Usá: rojo o negro (también red/black).';

      let amount;
      if (amountArg === 'all' || amountArg === 'todo') {
        const u = econUser(me);
        amount = u.cash;
      } else if (/^\d+$/.test(amountArg)) {
        amount = parseInt(amountArg, 10);
      } else {
        return 'Monto inválido.';
      }
      if (!amount || amount < 1000) return 'La apuesta mínima es de *1000 Coins*.';
      const u = econUser(me);
      if (amount > u.cash) return 'No tienes suficiente dinero para esa apuesta.';

      // Si no hay ronda activa, iniciarla automáticamente al apostar
      if (!g.active || g.jid !== ctx.jid) {
        g.active = true;
        g.jid = ctx.jid;
        g.starter = me;
        g.bets = new Map();
        g.endTime = Date.now() + 30 * 1000;

        await sendTo(
          ctx.jid,
          `\u200E🎡 *Ruleta DKS - Ronda abierta!*\n\nApostá con:\n#ruleta rojo <monto>\n#ruleta negro <monto>\n#ruleta red <monto>\n#ruleta black <monto>\nMínimo: *1000 Coins*\n\nTiempo para apostar: *30 segundos*\n¡Buena suerte! 🍀`
        );

        // Avisos cada 7 segundos
        const announce = (left) => {
          if (!g.active) return;
          if (left <= 0) return;
          sendTo(ctx.jid, `\u200E⏳ Quedan *${Math.ceil(left / 1000)}s* para apostar en la ruleta.`).catch(() => {});
        };
        announce(28000);
        announce(21000);
        announce(14000);
        announce(7000);

        g.interval = setTimeout(async () => {
          if (!g.active) return;
          g.active = false;
          clearTimeout(g.interval);
          g.interval = null;

          // Girar ruleta: solo rojo o negro
          const winningNum = Math.floor(Math.random() * 36) + 1; // 1-36
          const redNums = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
          const blackNums = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35];
          let winningColor = 'rojo';
          if (redNums.includes(winningNum)) winningColor = 'rojo';
          if (blackNums.includes(winningNum)) winningColor = 'negro';

          const lines = [];
          let totalPayout = 0;
          let totalBets = 0;

          for (const [userId, bet] of g.bets) {
            const u = econUser(userId);
            totalBets += bet.amount;
            let won = false;
            let multiplier = 0;
            if (bet.type === 'color') {
              if (bet.choice === winningColor) {
                won = true;
                multiplier = 2;
              }
            }
            if (won) {
              const payout = bet.amount * multiplier;
              u.cash += payout;
              totalPayout += payout;
              lines.push(`✅ *${displayName(userId)}* apostó ${money(bet.amount)} a *${bet.choice}* y ganó *${money(payout)}* (x${multiplier})`);
            } else {
              u.cash = Math.max(0, u.cash - bet.amount);
              lines.push(`❌ *${displayName(userId)}* apostó ${money(bet.amount)} a *${bet.choice}* y perdió.`);
            }
          }
          saveEcon();

          const colorEmoji = winningColor === 'rojo' ? '🔴' : '⚫';
          let resultMsg = `\u200E🎯 *Ruleta cerrada*\n\nNúmero ganador: ${colorEmoji} *${winningNum}* (${winningColor})\n\n`;
          if (g.bets.size === 0) {
            resultMsg += `Nadie apostó esta ronda.`;
          } else {
            resultMsg += `${lines.join('\n')}\n\nTotal apostado: *${money(totalBets)}*\nTotal pagado: *${money(totalPayout)}*`;
          }
          try {
            await sendTo(ctx.jid, resultMsg);
          } catch (e) {
            console.error('Error enviando resultado ruleta:', e.message);
          } finally {
            g.active = false;
            g.jid = null;
            g.starter = null;
            g.bets = new Map();
            g.interval = null;
          }
        }, 30000);
      }

      u.cash = Math.max(0, u.cash - amount);
      saveEcon();
      g.bets.set(me, { type: 'color', choice, amount });

      const emoji = choice === 'rojo' ? '🔴' : '⚫';
      return `${emoji} *${displayName(me)}* apostó *${money(amount)}* a *${choice}*. ¡Buena suerte! 🍀`;
    },
  },

  blackjack: {
    desc: ' Jugar Blackjack (21). Uso: #bj <apuesta> (mínimo 1000 Coins)',
    execute: async (ctx) => {
      if (!globalThis._bj) globalThis._bj = {};
      const me = getSenderId(ctx);
      if (globalThis._bj[me]) {
        return 'Ya tenés una partida en curso. Usá #pedir (otra carta) o #plantarme (cerrar).';
      }

      const u = econUser(me);
      const args = ctx.text.slice(config.prefix.length).trim().split(/\s+/).slice(1);
      const betArg = args[0];
      let bet;
      if (!betArg) return 'Uso: #bj <apuesta> (mínimo 1000 Coins). Ej: #bj 1000';
      if (betArg === 'all' || betArg === 'todo') bet = u.cash;
      else if (/^\d+$/.test(betArg)) bet = parseInt(betArg, 10);
      else return 'Uso: #bj <apuesta> (mínimo 1000 Coins). Ej: #bj 1000';
      if (!bet || bet < 1000) return 'La apuesta mínima es de *1000 Coins*.';
      if (bet > u.cash) return 'No tienes suficiente dinero para esa apuesta.';

      const deck = buildDeck();
      const player = [deck.pop(), deck.pop()];
      const dealer = [deck.pop(), deck.pop()];
      globalThis._bj[me] = { deck, player, dealer, bet };

      const pV = handValue(player);
      if (pV === 21) {
        const msgTxt = endBlackjack(me);
        return ` 🃏 *Blackjack*\n\n *Tú:* ${formatHand(player)} = *21*\n *Apuesta:* *${money(bet)}*\n\n¡BLACKJACK! 🎉 ${msgTxt}`;
      }

      return ` 🃏 *Blackjack DKS*\n\n *Tú:* ${formatHand(player)} = *${pV}*\n *Apuesta:* *${money(bet)}*\n\n *Banca:* ${formatHand([dealer[0]])} 🂠 = *${handValue([dealer[0]])}*\n\n ¿*#pedir* otra carta o te *#plantas*?`;
    },
  },

  pedir: {
    desc: ' Pedir otra carta en el Blackjack',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const game = globalThis._bj && globalThis._bj[me];
      if (!game) return 'No tenés partida en curso. Escribí #bj para comenzar.';
      game.player.push(game.deck.pop());
      const v = handValue(game.player);
      if (v > 21) {
        const u = econUser(me);
        u.cash = Math.max(0, u.cash - game.bet);
        saveEcon();
        delete globalThis._bj[me];
        return ` 🃏 *Blackjack*\n\n *Tú:* ${formatHand(game.player)} = *${v}*\n *Apuesta:* *${money(game.bet)}*\n\n Te pasaste de 21... 💥 *Perdiste ${money(game.bet)}.*`;
      }
      if (v === 21) {
        const res = endBlackjack(me);
        return ` 🃏 *Blackjack*\n\n *Tú:* ${formatHand(game.player)} = *21*\n *Apuesta:* *${money(game.bet)}*\n\n ¡21! 🎉\n\n${res}`;
      }
      return ` 🃏 *Blackjack DKS*\n\n *Tú:* ${formatHand(game.player)} = *${v}*\n *Apuesta:* *${money(game.bet)}*\n\n *Banca:* ${formatHand([game.dealer[0]])} 🂠 = *${handValue([game.dealer[0]])}*\n\n ¿Seguís con #pedir o te #plantas?`;
    },
  },

  plantarme: {
    desc: ' Plantarse en el Blackjack y juega la banca',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const game = globalThis._bj && globalThis._bj[me];
      if (!game) return 'No tenés partida en curso. Escribí #bj para comenzar.';
      const result = endBlackjack(me);
      return ` 🃏 *Blackjack*\n\n${result}`;
    },
  },

  work: {
    desc: ' Trabajá y ganá plata (tiene espera)',
    execute: async (ctx) => {
      const u = econUser(getSenderId(ctx));
      const left = cdLeft(u, 'work', 4 * 60 * 1000);
      if (left > 0) return fmtCooldownMsg(left, 'work');
      if (Math.random() < 1 / 1000000) {
        u.cash += 100000;
        cdSet(u, 'work');
        saveEcon();
        return `✿ ¡1 EN UN MILLÓN! Mora te donó *${money(100000)}*. ¡IMPOSIBLE!`;
      }
      const ganancia = rand(1000, 1500);
      u.cash += ganancia;
      cdSet(u, 'work');
      saveEcon();
      return `✿ ${pick(WORK_JOBS)} *${money(ganancia)}*.`;
    },
  },

  slut: {
    desc: ' Plata rápida pero con riesgo (tiene espera)',
    execute: async (ctx) => {
      const u = econUser(getSenderId(ctx));
      const left = cdLeft(u, 'slut', 6 * 60 * 1000);
      if (left > 0) return fmtCooldownMsg(left, 'slut');
      cdSet(u, 'slut');
      if (Math.random() < 0.35) {
        const perdida = Math.min(u.cash, rand(100, 3000));
        u.cash = Math.max(0, u.cash - perdida);
        saveEcon();
        return `✿ ${pick(SLUT_FAIL)} *${money(perdida)}*.`;
      }
      const ganancia = rand(300, 3000);
      u.cash += ganancia;
      saveEcon();
      return `✿ ${pick(SLUT_WIN)} *${money(ganancia)}*.`;
    },
  },

  crime: {
    desc: ' Delito de riesgo: plata o multa (tiene espera)',
    execute: async (ctx) => {
      const u = econUser(getSenderId(ctx));
      const left = cdLeft(u, 'crime', 8 * 60 * 1000);
      if (left > 0) return fmtCooldownMsg(left, 'crime');
      cdSet(u, 'crime');
      if (Math.random() < 0.4) {
        const multa = Math.min(u.cash, rand(300, 5000));
        u.cash = Math.max(0, u.cash - multa);
        saveEcon();
        return `✿ ${pick(CRIME_FAIL)} *${money(multa)}*.`;
      }
      const ganancia = rand(1000, 5000);
      u.cash += ganancia;
      saveEcon();
      return `✿ ${pick(CRIME_WIN)} *${money(ganancia)}*.`;
    },
  },

  daily: {
    desc: ' Reclamá tu regalo diario (24h). Base 30k + racha acumulada',
    execute: async (ctx) => {
      const u = econUser(getSenderId(ctx));
      const left = cdLeft(u, 'daily', 24 * 60 * 60 * 1000);
      if (left > 0) return fmtCooldownMsg(left, 'daily');

      // Calcular racha: si ya reclamó ayer, subir racha; si no, resetear a 1
      const now = Date.now();
      const lastDaily = u.cd.daily || 0;
      const diffHours = (now - lastDaily) / (1000 * 60 * 60);
      if (lastDaily && diffHours > 24 && diffHours <= 48) {
        u.dailyStreak += 1;
      } else if (!lastDaily || diffHours > 48) {
        u.dailyStreak = 1;
      }

      const base = 30000;
      const streakBonus = (u.dailyStreak - 1) * 5000; // +5k por cada día extra de racha
      const ganancia = base + streakBonus;

      u.cash += ganancia;
      cdSet(u, 'daily');
      saveEcon();

      return `✿ ¡Reclamaste tu regalo diario!\n💰 Base: *${money(base)}*\n🔥 Racha: *día ${u.dailyStreak}* (+${money(streakBonus)})\n━━━━━━━━━━━━━━━━━━━━━\n🎁 Total: *${money(ganancia)}*`;
    },
  },

  resetdaily: {
    desc: ' Reinicia el daily de usuarios con menos de 30k (solo owner)',
    execute: async (ctx) => {
      if (!isOwner(ctx)) return 'Solo el propietario puede usar este comando.';
      let reseteados = 0;
      for (const [id, u] of Object.entries(econ.users)) {
        if (typeof u.cash !== 'number') u.cash = 0;
        if (u.cash < 30000) {
          u.cd = u.cd || {};
          u.cd.daily = 0;
          u.dailyStreak = 0;
          reseteados++;
        }
      }
      saveEcon();
      return `✅ Daily reiniciado para *${reseteados}* usuario(s) con menos de ${money(30000)}.`;
    },
  },

  rob: {
    desc: ' Robále plata a otro usuario - uso: #rob <@usuario>',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      const left = cdLeft(u, 'rob', 10 * 60 * 1000);
      if (left > 0) return fmtCooldownMsg(left, 'rob');
      const target = getTargetUser(ctx);
      if (!target) return 'Mencioná a la víctima: #rob @usuario (o respondele a su mensaje).';
      if (target === me) return 'No podés robarte a vos mismo. 🤡';
      const t = econUser(target);
      if (t.cash <= 0) return `✿ ${displayName(target)} no tiene Coins. No robes a un pobre :v`;
      cdSet(u, 'rob');
      if (Math.random() < 0.5) {
        const steal = Math.min(t.cash, Math.max(50, rand(Math.floor(t.cash * 0.1), Math.floor(t.cash * 0.25))));
        t.cash -= steal;
        u.cash += steal;
        saveEcon();
        return `✿ Robaste *${money(steal)}* a *${displayName(target)}*.`;
      }
      const fine = Math.min(u.cash, rand(100, 600));
      u.cash = Math.max(0, u.cash - fine);
      saveEcon();
      return `✿ ¡Te atraparon! Perdiste *${money(fine)}*.`;
    },
  },

  pay: {
    desc: ' Transfiere dinero a otro - uso: #pay <@usuario> <monto|all>',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      const target = getTargetUser(ctx);
      if (!target) return 'Uso: #pay @usuario <monto|all> (o respondele a su mensaje con #pay <monto>).';
      if (target === me) return 'No podés transferirte dinero a vos mismo.';
      const args = ctx.text.slice(config.prefix.length).trim().split(/\s+/).slice(1);
      const amountArg = args.length ? args[args.length - 1].toLowerCase() : '';
      let amount;
      if (amountArg === 'all' || amountArg === 'todo') amount = u.cash;
      else if (/^\d+$/.test(amountArg)) amount = parseInt(amountArg, 10);
      else return 'Uso: #pay @usuario <monto|all>';
      if (!amount || amount <= 0) return 'Monto inválido.';
      if (amount > u.cash) return 'No tienes suficiente dinero para transferir.';
      u.cash = Math.max(0, u.cash - amount);
      econUser(target).cash += amount;
      saveEcon();
      return `✿ Transferiste *${money(amount)}* a *${displayName(target)}*.`;
    },
  },

  bal: {
    desc: ' Ver saldo (el tuyo o de otro con @usuario)',
    execute: async (ctx) => {
      const id = getTargetUser(ctx) || getSenderId(ctx);
      const u = econUser(id);
      const total = u.cash + u.bank;
      return `✿ 》》Economía *${displayName(id)}*《《 ✿\n\n⛀ Dinero » *${money(u.cash)}*\n⚿ Banco » *${money(u.bank)}*\n⛁ Total » *${money(total)}*\n\n> Para proteger tu dinero, ¡deposítalo en el banco usando #deposit!`;
    },
  },

  baltop: {
    desc: ' Top de usuarios más ricos - uso: #baltop [página]',
    execute: async (ctx) => {
      const rows = Object.entries(econ.users)
        .map(([id, u]) => ({ id, total: (Number(u.cash) || 0) + (Number(u.bank) || 0) }))
        .filter((r) => r.total > 0)
        .sort((a, b) => b.total - a.total);
      if (rows.length === 0) return '✿ Todavía no hay plata por acá. ¡Escribí #work para empezar!';
      const perPage = 10;
      const pages = Math.max(1, Math.ceil(rows.length / perPage));
      const arg = ctx.text.slice(config.prefix.length + 7).trim();
      let page = /^\d+$/.test(arg) ? parseInt(arg, 10) : 1;
      if (page < 1 || page > pages) page = 1;
      const slice = rows.slice((page - 1) * perPage, page * perPage);
      let txt = '「✿」Los usuarios con más Coins son:\n\n';
      slice.forEach((r, i) => {
        const rank = (page - 1) * perPage + i + 1;
        txt += `✰ ${rank} » *${displayName(r.id)}*\n\t\t Total→ *${money(r.total)}*\n`;
      });
      txt += `\n> • Página ${page} de ${pages}`;
      return txt;
    },
  },

  deposit: {
    desc: ' Depositá efectivo en el banco - uso: #deposit <monto|all>',
    execute: async (ctx) => {
      const u = econUser(getSenderId(ctx));
      const arg = ctx.text.slice(config.prefix.length + 8).trim().toLowerCase();
      let amount;
      if (arg === 'all' || arg === 'todo') amount = u.cash;
      else if (/^\d+$/.test(arg)) amount = parseInt(arg, 10);
      else return 'Uso: #deposit <monto> o #deposit all';
      if (!amount || amount <= 0) return 'No tenés efectivo para depositar.';
      if (amount > u.cash) return `Solo tenés *${money(u.cash)}* en efectivo.`;
      u.cash -= amount;
      u.bank += amount;
      saveEcon();
      return `✿ Depositaste *${money(amount)}* en el banco, ya no podrán robártelo.`;
    },
  },

  withdraw: {
    desc: ' Sacá plata del banco - uso: #withdraw <monto|all>',
    execute: async (ctx) => {
      const u = econUser(getSenderId(ctx));
      const arg = ctx.text.slice(config.prefix.length + 9).trim().toLowerCase();
      let amount;
      if (arg === 'all' || arg === 'todo') amount = u.bank;
      else if (/^\d+$/.test(arg)) amount = parseInt(arg, 10);
      else return 'Uso: #withdraw <monto> o #withdraw all';
      if (!amount || amount <= 0) return 'No tenés plata en el banco.';
      if (amount > u.bank) return `Solo tenés *${money(u.bank)}* en el banco.`;
      u.bank -= amount;
      u.cash += amount;
      saveEcon();
      return `✿ Retiraste *${money(amount)}* del banco, cuida tu dinero.`;
    },
  },

  give: {
    desc: ' Regalá dinero a alguien. Uso: #give @usuario <monto>',
    execute: async (ctx) => {
      const target = getTargetUser(ctx);
      const args = ctx.text.slice(config.prefix.length).trim().split(/\s+/).slice(1);
      const amountArg = args.length ? args[args.length - 1] : '';
      if (!target || !/^\d+$/.test(amountArg) || parseInt(amountArg, 10) <= 0) {
        return 'Uso: #give @usuario <monto>';
      }
      const amount = parseInt(amountArg, 10);
      econUser(target).cash += amount;
      saveEcon();
      return `✿ Le diste *${money(amount)}* a *${displayName(target)}*.`;
    },
  },

  take: {
    desc: ' Quitá dinero a alguien. Uso: #take @usuario <monto>',
    execute: async (ctx) => {
      const target = getTargetUser(ctx);
      const args = ctx.text.slice(config.prefix.length).trim().split(/\s+/).slice(1);
      const amountArg = args.length ? args[args.length - 1] : '';
      if (!target || !/^\d+$/.test(amountArg) || parseInt(amountArg, 10) <= 0) {
        return 'Uso: #take @usuario <monto>';
      }
      const amount = parseInt(amountArg, 10);
      const t = econUser(target);
      const taken = Math.min(amount, t.cash);
      t.cash = Math.max(0, t.cash - taken);
      saveEcon();
      return `✿ Le quitaste *${money(taken)}* a *${displayName(target)}*.`;
    },
  },

  perm: {
    desc: ' Gestiona permisos de uso (solo admins del grupo)',
    execute: async (ctx) => {
      if (!(await isGroupAdmin(ctx)) && !isOwner(ctx)) return 'Solo los admins del grupo pueden usar este comando.';
      const parts = ctx.text.slice(config.prefix.length + 4).trim().split(/\s+/);
      const action = parts[0] ? parts[0].toLowerCase() : '';
      const num = parts[1] ? parts[1].replace(/\D/g, '') : null;

      if (action === 'list' || action === '') {
        const list =
          settings.allowedUsers && settings.allowedUsers.length
            ? settings.allowedUsers.map((n) => `• ${displayName(jidNum(n))}`).join('\n')
            : '*Nadie* todavía';
        return ` *Usuarios con permiso:*\n\n${list}`;
      }

      if (!num) return `Uso: ${config.prefix}perm add <número> | ${config.prefix}perm del <número> | ${config.prefix}perm list`;

      if (action === 'add') {
        if ((settings.allowedUsers || []).includes(num)) return `⚠️ ${displayName(num)} ya tiene permiso.`;
        settings.allowedUsers = settings.allowedUsers || [];
        settings.allowedUsers.push(num);
        saveSettings();
        return `✅ Permiso otorgado a ${displayName(num)}`;
      }

      if (action === 'del') {
        const idx = (settings.allowedUsers || []).indexOf(num);
        if (idx === -1) return `⚠️ ${displayName(num)} no tiene permiso.`;
        settings.allowedUsers.splice(idx, 1);
        saveSettings();
        return `🗑️ Permiso retirado a ${displayName(num)}`;
      }

      return `Uso: ${config.prefix}perm add <número> | ${config.prefix}perm del <número> | ${config.prefix}perm list`;
    },
  },

  promote: {
    desc: ' Da permiso de uso a alguien (solo admins del grupo)',
    execute: async (ctx) => {
      if (!(await isGroupAdmin(ctx)) && !isOwner(ctx)) return 'Solo los admins del grupo pueden usar este comando.';
      const argNum = ctx.text.slice(config.prefix.length + 7).trim().replace(/\D/g, '');
      const num = argNum || getTargetFromReply(ctx);
      if (!num) {
        return `Uso: ${config.prefix}promote <número>\n   o respondé a un mensaje de la persona.`;
      }
      settings.allowedUsers = settings.allowedUsers || [];
      if (settings.allowedUsers.includes(num)) return `⚠️ ${displayName(num)} ya tiene permiso.`;
      settings.allowedUsers.push(num);
      saveSettings();
      return `✅ *${displayName(num)}* ahora puede usar el bot.`;
    },
  },

  demote: {
    desc: ' Quita permiso de uso a alguien (solo admins del grupo)',
    execute: async (ctx) => {
      if (!(await isGroupAdmin(ctx)) && !isOwner(ctx)) return 'Solo los admins del grupo pueden usar este comando.';
      const argNum = ctx.text.slice(config.prefix.length + 6).trim().replace(/\D/g, '');
      const num = argNum || getTargetFromReply(ctx);
      if (!num) {
        return `Uso: ${config.prefix}demote <número>\n   o respondé a un mensaje de la persona.`;
      }
      settings.allowedUsers = settings.allowedUsers || [];
      const idx = settings.allowedUsers.indexOf(num);
      if (idx === -1) return `⚠️ ${displayName(num)} no tiene permiso.`;
      settings.allowedUsers.splice(idx, 1);
      saveSettings();
      return `🗑️ *${displayName(num)}* ya no puede usar el bot.`;
    },
  },

  setup: {
    desc: ' Habilita el chat actual para el bot (solo admins del grupo)',
    execute: async (ctx) => {
      if (!(await isGroupAdmin(ctx)) && !isOwner(ctx)) return 'Solo los admins del grupo pueden usar este comando.';
      if (!ctx.jid) return 'No se pudo identificar este chat.';
      settings.allowedChats = settings.allowedChats || [];
      if (settings.allowedChats.includes(ctx.jid)) {
        return `⚠️ Este chat ya estaba habilitado.`;
      }
      settings.allowedChats.push(ctx.jid);
      saveSettings();
      return `🔓 Chat habilitado para el bot.`;
    },
  },

  unlock: {
    desc: ' Deshabilita el chat actual para el bot (solo admins del grupo)',
    execute: async (ctx) => {
      if (!(await isGroupAdmin(ctx)) && !isOwner(ctx)) return 'Solo los admins del grupo pueden usar este comando.';
      settings.allowedChats = settings.allowedChats || [];
      const idx = settings.allowedChats.indexOf(ctx.jid);
      if (idx === -1) return `⚠️ Este chat no estaba habilitado.`;
      settings.allowedChats.splice(idx, 1);
      saveSettings();
      return `🔒 Chat deshabilitado. El bot ignorará todo acá.`;
    },
  },

  lock: {
    desc: ' Lista los chats habilitados (solo admins del grupo)',
    execute: async (ctx) => {
      if (!(await isGroupAdmin(ctx)) && !isOwner(ctx)) return 'Solo los admins del grupo pueden usar este comando.';
      const ids = settings.allowedChats || [];
      if (ids.length === 0) {
        return '*Ninguno* todavía. Usá #setup en el chat que querés habilitar.';
      }
      const lines = [];
      for (const id of ids) {
        try {
          const meta = await getMeta(id);
          lines.push(`• ${meta.subject || id}`);
        } catch (e) {
          lines.push(`• (grupo sin nombre)`);
        }
      }
      return ` *Chats habilitados:*\n\n${lines.join('\n')}`;
    },
  },
};

const commandAliases = { bj: 'blackjack', planto: 'plantarme', plantas: 'plantarme', balance: 'bal', dep: 'deposit', wd: 'withdraw', w: 'work', robar: 'rob', regalo: 'daily', rt: 'ruleta' };

const processCommand = async (ctx) => {
  if (!ctx.text || !ctx.text.startsWith(config.prefix)) return;

  const fullCommand = ctx.text.slice(config.prefix.length).trim().split(' ')[0].toLowerCase();
  const resolvedCommand = commandAliases[fullCommand] || fullCommand;
  const command = commands[resolvedCommand];

  if (!command) return;
  console.log('[cmd]', resolvedCommand, 'from', getSenderId(ctx));

  const chatAdminCommands = ['setup', 'unlock', 'lock', 'lobby', 'setform', 'setmain'];
  const adminGroupCommands = ['bienvenido', 'expulsar', 'setmain', 'seguir', 'perm', 'promote', 'demote'];
  const publicCommands = ['help', 'info', 'ping', 'medida', 'match', '8ball', 'ruleta', 'blackjack', 'pedir', 'plantarme', 'testlobby', 'work', 'slut', 'crime', 'bal', 'baltop', 'deposit', 'withdraw', 'daily', 'rob', 'pay', 'give', 'take'];

  if (!chatAdminCommands.includes(resolvedCommand) && !isChatAllowed(ctx)) return;

  if (!publicCommands.includes(resolvedCommand) && !hasPermission(ctx)) {
    if (!(adminGroupCommands.includes(resolvedCommand) && (await isGroupAdmin(ctx)))) {
      await reply(ctx, '❌ No tienes permiso para usar el bot.');
      return;
    }
  }

  const result = await command.execute(ctx);

  if (typeof result === 'string') {
    const t0 = Date.now();
    await Promise.race([
      reply(ctx, result).then(() => console.log('[reply] ok', Date.now() - t0 + 'ms')),
      new Promise((r) => setTimeout(() => { console.log('[reply] TIMEOUT'); r(); }, 8000)),
    ]);
  } else if (result && result.type === 'sticker') {
    await sock.sendMessage(ctx.jid, { sticker: result.buffer }, { quoted: ctx.m });
  }
};

const buildNames = (recipients) =>
  recipients.map((id) => `@${displayName(jidNum(id))}`).join(', ');

const buildMentions = (recipients) =>
  recipients.map((id) => asJid(id));

const welcomeMembers = async (jid, meta, recipients) => {
  const st = getChatSettings(jid);
  if (!st.welcome) return;
  if (!recipients || recipients.length === 0) return;
  const welcomeMsg = formatTemplate(st.welcomeText, {
    nombres: buildNames(recipients),
    grupo: meta.subject,
    desc: meta.desc || 'Sin descripción',
    members: meta.participants.length,
  });
  await sendTo(jid, welcomeMsg, buildMentions(recipients));
};

const lobbySendForm = async (jid, recipients) => {
  const key = jid;
  const st = getChatSettings(key);
  if (!st.lobby) return;
  if (!recipients || recipients.length === 0) return;
  const nums = recipients.map((r) => jidNum(r));
  settings.pendingLobby = settings.pendingLobby || {};
  settings.pendingLobby[key] = settings.pendingLobby[key] || [];
  nums.forEach((n) => {
    const exists = settings.pendingLobby[key].some((p) => (typeof p === 'string' ? p : p.n) === n);
    if (!exists) settings.pendingLobby[key].push({ n, stage: 'form', record: null, nombre: null });
  });
  saveSettings();
  await sendTo(jid, '\u200E' + st.lobbyForm, buildMentions(recipients));
};

const findPending = (key, n) => {
  const list = (settings.pendingLobby && settings.pendingLobby[key]) || [];
  const raw = list.find((p) => (typeof p === 'string' ? p : p.n) === n);
  if (!raw) return null;
  return typeof raw === 'string'
    ? { n: raw, stage: 'form', record: null, nombre: null }
    : raw;
};

const handleLobbyAnswer = async (ctx) => {
  if (ctx.text && ctx.text.startsWith('\u200E')) return false;
  if (!ctx.isGroup) return false;
  const key = ctx.jid;
  const st = getChatSettings(key);
  const sender = getSenderId(ctx);
  settings.pendingLobby = settings.pendingLobby || {};
  const entry = findPending(key, sender);
  if (!entry) return false;
  if (ctx.fromMe && !entry.test) return false;
  if (!st.lobby && !entry.test) return false;
  console.log('[lobby]', sender, 'stage=' + entry.stage, JSON.stringify(String(ctx.text || '').slice(0, 80)));

  if (entry.stage === 'form') {
    const rawLines = (ctx.text || '').split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    entry.formData = entry.formData || {};
    const { hasLabels } = parseFormData(rawLines, entry.formData);

    const isComplete = Object.keys(entry.formData).length >= 6 || (hasLabels && Object.keys(entry.formData).length >= 3);

    if (!isComplete) {
      const t = (ctx.text || '').trim().toLowerCase();
      if (ACK.includes(t)) {
        const pending = 6 - Object.keys(entry.formData).length;
        await reply(
          ctx,
          `\u200E📋 Te faltan ${pending} campo(s). Mandá lo que falte o el formulario completo:\n` + st.lobbyForm
        );
      }
      saveSettings();
      return true;
    }

    const getVal = (i) => entry.formData[i] || '—';
    const [recluta, nombre, edad, roblox, pais, pronombres] = [0,1,2,3,4,5].map(getVal);

    entry.record =
      `* Reclutado por: ${recluta}\n` +
      `* Nombre: ${nombre}\n` +
      `* Edad: ${edad}\n` +
      `* Roblox: ${roblox}\n` +
      `* País: ${pais}\n` +
      `* Pronombres: ${pronombres}`;
    entry.nombre = nombre !== '—' ? nombre : 'amigo/a';
    entry.stage = 'otro_clan';
    delete entry.formData;
    saveSettings();
    await reply(ctx, '\u200E¿Vienes de otro clan o estás vinculado a alguno actualmente? (si/no)');
    return true;
  }

  if (entry.stage === 'otro_clan') {
    const resp = (ctx.text || '').trim().toLowerCase();
    const esSi = ['si', 'sí', 'yes', 'sip', 'dale', 'vengo', 'estoy'].some(w => resp.startsWith(w));
    if (esSi) {
      entry.otroClan = true;
      entry.stage = 'clan_detalle';
      saveSettings();
      await reply(ctx, '\u200E¿De qué clan vienes y cuál fue la razón de tu salida?');
      return true;
    }
    entry.otroClan = false;
    entry.record += `\n* Vienes de otro clan: no`;
    entry.stage = 'iniciales';
    saveSettings();
    await reply(ctx, '\u200ELas iniciales del clan son obligatorias y son: *DKS*\n\nSi ya las tienes di *"Listo"* y si aún no las tienes dinos el por qué.');
    return true;
  }

  if (entry.stage === 'clan_detalle') {
    const texto = (ctx.text || '').trim();
    entry.record += `\n* Vienes de otro clan: sí\n* Clan anterior: ${texto || '—'}`;
    entry.stage = 'iniciales';
    saveSettings();
    await reply(ctx, '\u200ELas iniciales del clan son obligatorias y son: *DKS*\n\nSi ya las tienes di *"Listo"* y si aún no las tienes dinos el por qué.');
    return true;
  }

  if (entry.stage === 'iniciales') {
    const resp = (ctx.text || '').trim();
    const listo = ['listo', 'ya las tengo', 'ya las tengo.', 'tengo', 'ok', 'sí', 'si'].some(w => resp.toLowerCase().includes(w));
    if (listo) {
      entry.record += `\n* Iniciales DKS: sí (las tiene)`;
    } else {
      entry.record += `\n* Iniciales DKS: no — ${resp || 'sin respuesta'}`;
    }
    entry.stage = 'confirm';
    saveSettings();
    await reply(
      ctx,
      `\u200E✅ ¡Formulario recibido, ${entry.nombre}! 🎉\n\n${entry.record}\n\n¿Todo listo?\n\nPara confirmar tu entrada a DKS respondé: *ok*`
    );
    return true;
  }

  if (entry.stage === 'confirm') {
    const t = (ctx.text || '').trim().toLowerCase();
    if (['ok', 'okey', 'oki', 'si', 'sí', 'dale', 'confirmo', 'sip', 'yes'].includes(t)) {
      if (entry.test) {
        const list = settings.pendingLobby[key] || [];
        settings.pendingLobby[key] = list.filter((p) => (typeof p === 'string' ? p : p.n) !== sender);
      } else {
        entry.stage = 'sent';
      }
      saveSettings();
      const link = await getMainInviteLink();
      if (!link) {
        await reply(ctx, `\u200E✅ Entrada *confirmada*, ${entry.nombre}! 🎉\n\n⚠️ El link del grupo principal aún no está configurado. Avisá a un admin.`);
        return true;
      }
      await reply(
        ctx,
        `\u200E🎉 ¡Entrada *confirmada*, ${entry.nombre}!\n\n👉 Únete al grupo principal con este enlace:\n${link}\n\nCuando te unas, este bot te saca del lobby. ✨`
      );
      await rotateMainInvite();
      return true;
    }
    await reply(ctx, '\u200ENecesito tu confirmación. Si querés entrar a DKS, respondé: *ok*');
    return true;
  }

  return false;
};

const getMainInviteLink = async () => {
  if (!settings.mainGroupId) return config.mainGroupLink || '';
  try {
    const code = await sock.groupInviteCode(settings.mainGroupId);
    if (code) return `https://chat.whatsapp.com/${code}`;
  } catch (e) {
    console.error('Error obteniendo link del grupo principal:', e.message);
  }
  return config.mainGroupLink || '';
};

const rotateMainInvite = async () => {
  if (!settings.mainGroupId) return;
  try {
    await sock.groupRevokeInvite(settings.mainGroupId);
    await sock.groupInviteCode(settings.mainGroupId);
    console.log('[main] Link del grupo principal regenerado');
  } catch (e) {
    console.error('Error rotando link del grupo principal:', e.message);
  }
};

const lobbyOnJoinMain = async (recipients) => {
  if (!settings.pendingLobby) return;
  let changed = false;
  for (const raw of recipients) {
    const num = jidNum(raw);
    if (!num) continue;
    console.log('[lobbyOnJoinMain] checking', num);
    for (const key of Object.keys(settings.pendingLobby)) {
      const list = settings.pendingLobby[key];
      const i = list.findIndex((p) => {
        const n = jidNum(typeof p === 'string' ? p : p.n);
        const st = typeof p === 'string' ? 'form' : p.stage;
        return n === num && st === 'sent';
      });
      if (i === -1) continue;
      console.log('[lobbyOnJoinMain] found pending in lobby', key, 'for', num);
      try {
        if (!isGroupJid(key)) {
          continue;
        }
        const meta = await sock.groupMetadata(key);
        const me = meta.participants.find((p) => isSelfJid(p.id));
        if (!me || !me.admin) {
          console.log('[lobbyOnJoinMain] bot not admin in lobby:', key);
          continue;
        }
        const part = meta.participants.find((p) => jidNum(p.id) === num);
        if (part) {
          await sock.groupParticipantsUpdate(key, [part.id], 'remove');
          metaCache.delete(key);
          console.log('[lobbyOnJoinMain] removed', num, 'from lobby', key);
        } else {
          console.log('[lobbyOnJoinMain] participant not in lobby:', num);
        }
      } catch (e) {
        console.error('[lobbyOnJoinMain] error removing:', e.message);
      }
      list.splice(i, 1);
      changed = true;
    }
  }
  if (changed) saveSettings();
};

const goodbyeMembers = async (jid, meta, recipients) => {
  const st = getChatSettings(jid);
  if (!st.goodbye) return;
  if (!recipients || recipients.length === 0) return;
  const goodbyeMsg = formatTemplate(st.goodbyeText, {
    nombres: buildNames(recipients),
    grupo: meta.subject,
    desc: meta.desc || 'Sin descripción',
    members: meta.participants.length,
  });
  await sendTo(jid, goodbyeMsg, buildMentions(recipients));
};

const handleMessage = async (ctx) => {
  const allowed = isChatAllowed(ctx);
  console.log(
    '[msg]',
    getSenderId(ctx),
    ctx.text ? ctx.text.slice(0, 40) : '(no body)',
    ctx.type || '(no type)',
    'allowed=' + allowed,
    ctx.fromMe ? '(fromMe)' : ''
  );

  if (ctx.fromMe) {
    if (await handleLobbyAnswer(ctx)) return;
    await processCommand(ctx);
    return;
  }

  if (!allowed) return;

  if (ctx.isGroup && getChatSettings(ctx.jid).antilink) {
    const linkRegex = /https?:\/\/[^\s]+|www\.[^\s]+|chat\.whatsapp\.com\/[^\s]+/gi;
    if (linkRegex.test(ctx.text)) {
      const isAdmin = await isGroupAdmin(ctx);
      if (!isAdmin && !isOwner(ctx)) {
        await reply(ctx, ' *Anti-links activado*\nNo se permiten enlaces en este grupo.');
        try {
          await sock.sendMessage(ctx.jid, { delete: ctx.m.key });
        } catch (e) {
          console.error('No se pudo borrar el mensaje (¿bot es admin?):', e.message);
        }
        return;
      }
    }
  }

  await processCommand(ctx);
  if (await handleLobbyAnswer(ctx)) return;

  if (!ctx.isGroup) return;
  if (!getChatSettings(ctx.jid).antispam) return;

  const sender = ctx.senderJid;
  const now = Date.now();

  if (!globalThis._spamTracker) globalThis._spamTracker = {};

  if (!globalThis._spamTracker[sender]) {
    globalThis._spamTracker[sender] = { count: 1, firstMsg: now };
    return;
  }

  const tracker = globalThis._spamTracker[sender];
  if (now - tracker.firstMsg > 5000) {
    tracker.count = 1;
    tracker.firstMsg = now;
    return;
  }

  tracker.count++;
  if (tracker.count >= 5) {
    await sendTo(ctx.jid, ` @${displayName(ctx.senderNum)} *Anti-spam:* Has enviado demasiados mensajes rápido. Calma un poco.`);
    tracker.count = 0;
    tracker.firstMsg = now;
  }
};

const onGroupParticipants = async ({ id, participants, action }) => {
  try {
    if (!participants || participants.length === 0) return;
    if (action === 'add') {
      await lobbyOnJoinMain(participants);
      if (settings.mainGroupId && id === settings.mainGroupId) {
        await rotateMainInvite();
      }
      if (!isChatAllowedId(id)) return;
      try {
        const meta = await getMeta(id);
        await welcomeMembers(id, meta, participants);
      } catch (e) {
        console.error('Error en bienvenida:', e.message || e);
      }
      try {
        await lobbySendForm(id, participants);
      } catch (e) {
        console.error('Error enviando formulario del lobby:', e.message || e);
      }
    } else if (action === 'remove' || action === 'leave') {
      if (!isChatAllowedId(id)) return;
      if (action === 'remove' && getChatSettings(id).lobby) {
        const botNum = jidNum(sock.user.id);
        const kicked = participants.filter((p) => jidNum(p) !== botNum);
        if (kicked.length) {
          await rotateMainInvite();
        }
      }
      const meta = await getMeta(id);
      await goodbyeMembers(id, meta, participants);
    }
    metaCache.delete(id);
  } catch (err) {
    console.error('Error en evento de grupo:', err.message || err);
  }
};

const startBot = async () => {
  const { state, saveCreds } = await useMultiFileAuthState('baileys_auth');
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger,
    browser: ['DKS Bot (Termux)', 'Chrome', '1.0.0'],
    syncFullHistory: false,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
  });

  _ready = false;
  _lastClientEvent = Date.now();

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    _lastClientEvent = Date.now();
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log('\n Escanea el QR con tu WhatsApp:\n');
      qrcode.generate(qr, { small: true });
      try {
        fs.writeFileSync('qr-data.txt', qr);
        QRCode.toFile('qr.png', qr, { width: 300 });
        console.log('QR guardado en qr.png y qr-data.txt');
      } catch (e) {
        console.error('No se pudo guardar el QR como imagen:', e.message);
      }
    }
    if (connection === 'open') {
      _ready = true;
      console.log(`\n✓ ${config.botName} conectado y listo!\n`);
    }
    if (connection === 'close') {
      _ready = false;
      const code = lastDisconnect?.error?.output?.statusCode ?? lastDisconnect?.error?.data?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      console.error('✗ Conexión cerrada (código ' + code + ')' + (loggedOut ? ' -> sesión cerrada' : ' -> reconectando...'));
      if (loggedOut) {
        console.error('Sesión cerrada desde el teléfono. Borrá la carpeta baileys_auth y volvé a escanear el QR.');
        process.exit(1);
      }
      setTimeout(() => {
        startBot().catch((e) => {
          console.error('Error al reconectar:', e);
          process.exit(1);
        });
      }, 3000);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    if (!globalThis._seenMsgs) globalThis._seenMsgs = new Map();
    const seen = globalThis._seenMsgs;
    if (seen.size > 400) {
      const now = Date.now();
      for (const [k, t] of seen) if (now - t > 10 * 60 * 1000) seen.delete(k);
    }
    for (const m of messages) {
      if (!m || !m.message || !m.key || !m.key.remoteJid) continue;
      if (m.key.id) {
        if (seen.has(m.key.id)) continue;
        seen.set(m.key.id, Date.now());
      }
      const jid = m.key.remoteJid;
      if (jid === 'status@broadcast' || jid.endsWith('@newsletter') || jid.endsWith('@g.us2')) continue;
      try {
        const ctx = buildCtx(m);
        const senderNum = ctx.fromMe ? jidNum(sock.user.id) : jidNum(ctx.m.key.participant || ctx.m.key.remoteJid);
        if (m.pushName && econ.names && econ.names[senderNum] !== m.pushName) {
          econ.names[senderNum] = m.pushName;
          saveEcon();
        }
        await handleMessage(ctx);
      } catch (err) {
        console.error('Error procesando mensaje:', err.message || err);
      }
    }
  });

  sock.ev.on('group-participants.update', onGroupParticipants);

  console.log(`\n${config.botName} - Iniciando...\n`);
};

setInterval(() => {
  if (_ready) return;
  if (Date.now() - _lastClientEvent > 10 * 60 * 1000) {
    console.error('✗ Sin conexión en 10 minutos -> reiniciando proceso');
    process.exit(1);
  }
}, 30 * 1000);

process.on('uncaughtException', (err) => {
  console.error('✗ uncaughtException:', (err && err.stack) || err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('✗ unhandledRejection:', (reason && reason.stack) || reason);
});

startBot().catch((e) => {
  console.error('Error iniciando el bot:', e);
  process.exit(1);
});
