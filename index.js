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
const path = require('path');
const crypto = require('crypto');
const config = require('./config');
const { imageToSticker } = require('./lib/sticker');
const { parseFormData, ACK } = require('./lib/lobbyForm');
const rpg = require('./lib/rpg');

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
  restrictedCommands: [],
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

const DKS_DATA_DIR = process.env.DKS_DATA_DIR || path.join(__dirname, '..', 'dks-data');
const ECON_FILE = path.join(DKS_DATA_DIR, 'economy.json');
let econ = { users: {}, names: {} };
let econDirty = false;
let econSaveTimer = null;

const ensureDataDir = () => {
  try {
    fs.mkdirSync(DKS_DATA_DIR, { recursive: true });
  } catch (e) {
    console.error('No se pudo crear carpeta de datos:', e.message);
  }
};

const atomicWrite = (file, data) => {
  const tmp = file + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, data, { encoding: 'utf8' });
  fs.fsyncSync(fs.openSync(tmp, 'r'));
  fs.renameSync(tmp, file);
};

const loadEcon = () => {
  ensureDataDir();
  let loaded = false;
  if (fs.existsSync(ECON_FILE)) {
    try {
      const raw = fs.readFileSync(ECON_FILE, 'utf8');
      econ = { users: {}, names: {}, ...JSON.parse(raw) };
      loaded = true;
    } catch (err) {
      const corrupt = ECON_FILE + '.corrupt-' + Date.now() + '.json';
      try {
        fs.copyFileSync(ECON_FILE, corrupt);
        console.error('Economy JSON corrupto, apartado como:', corrupt);
      } catch (e2) {
        console.error('No se pudo apartar economy corrupto:', e2.message);
      }
    }
  }

  // Migrar viejo economy.json de la carpeta del bot si existe
  const oldEcon = path.join(__dirname, 'economy.json');
  if (!loaded && fs.existsSync(oldEcon)) {
    try {
      const raw = fs.readFileSync(oldEcon, 'utf8');
      econ = { users: {}, names: {}, ...JSON.parse(raw) };
      loaded = true;
      console.error('Migrado economy.json desde carpeta del bot a:', ECON_FILE);
    } catch (err) {
      console.error('No se pudo leer economy.json viejo:', err.message);
    }
  }

  if (!econ.users) econ.users = {};
  if (!econ.names) econ.names = {};

  // Sanitizar: saldos negativos, NaN o texto -> 0
  for (const [id, u] of Object.entries(econ.users)) {
    if (!u || typeof u !== 'object') {
      econ.users[id] = { cash: 0, bank: 0, cd: {}, dailyStreak: 0 };
      continue;
    }
    if (typeof u.cash !== 'number' || !isFinite(u.cash) || u.cash < 0) u.cash = 0;
    if (typeof u.bank !== 'number' || !isFinite(u.bank) || u.bank < 0) u.bank = 0;
    if (!u.cd) u.cd = {};
    if (typeof u.dailyStreak !== 'number' || !isFinite(u.dailyStreak) || u.dailyStreak < 0) u.dailyStreak = 0;
  }
};

const markEconDirty = () => {
  econDirty = true;
  if (econSaveTimer) clearTimeout(econSaveTimer);
  econSaveTimer = setTimeout(() => {
    econSaveTimer = null;
    if (econDirty) {
      econDirty = false;
      try {
        atomicWrite(ECON_FILE, JSON.stringify(econ, null, 2));
      } catch (err) {
        console.error('No se pudo guardar economy:', err.message);
      }
    }
  }, 200);
};

const saveEcon = () => {
  markEconDirty();
};

const flushEcon = () => {
  if (econSaveTimer) {
    clearTimeout(econSaveTimer);
    econSaveTimer = null;
  }
  if (econDirty) {
    econDirty = false;
    try {
      atomicWrite(ECON_FILE, JSON.stringify(econ, null, 2));
    } catch (err) {
      console.error('No se pudo hacer flush de economy:', err.message);
    }
  }
};

loadEcon();

const peek = (id) => {
  const u = econ.users && econ.users[id];
  if (!u) return null;
  return { cash: typeof u.cash === 'number' ? u.cash : 0, bank: typeof u.bank === 'number' ? u.bank : 0 };
};

const AUDIT_FILE = path.join(DKS_DATA_DIR, 'audit.log');
const writeAuditLog = (action, byId, toId, amount, chatId) => {
  try {
    const line = JSON.stringify({
      t: new Date().toISOString(),
      action,
      by: byId,
      to: toId,
      amount,
      chat: chatId,
    });
    fs.appendFileSync(AUDIT_FILE, line + '\n');
  } catch (e) {
    console.error('No se pudo escribir log de auditoría:', e.message);
  }
};

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

const rpgLeft = (u, cmd, ms) => Math.max(0, (u.rpg.cd && u.rpg.cd[cmd] || 0) + ms - Date.now());
const rpgCdSet = (u, cmd) => {
  if (!u.rpg) u.rpg = {};
  if (!u.rpg.cd) u.rpg.cd = {};
  u.rpg.cd[cmd] = Date.now();
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
    // Banca se pasó: devolver apuesta + igual monto (2x total)
    u.cash += bet * 2;
    markEconDirty();
    outcome = `\n\n ¡La banca se pasó! 🎉 *Ganaste ${money(bet * 2)}.*`;
  } else if (pV > dV) {
    // Ganar: devolver apuesta + igual monto (2x total)
    u.cash += bet * 2;
    markEconDirty();
    outcome = `\n\n 🎉 *Ganaste ${money(bet * 2)}.*`;
  } else if (pV === dV) {
    // Empate: devolver solo la apuesta (1x total)
    u.cash += bet;
    markEconDirty();
    outcome = `\n\n 🤝 *Empate.* Te devuelven tu apuesta ${money(bet)}.`;
  } else {
    // Perder: la apuesta ya fue descontada al inicio (custodia)
    markEconDirty();
    outcome = `\n\n 😞 *Perdiste ${money(bet)}.*`;
  }

  writeAuditLog('blackjack', me, me, bet, '');
  return `${head}${outcome}`;
};

const generarEventoMazmorra = (session) => {
  const r = Math.random();
  const piso = session.piso;

  if (r < 0.55) {
    // Ganas monedas
    const base = 500 + piso * 300;
    const ganancia = Math.floor(base * (0.8 + Math.random() * 0.4));
    session.ganado += ganancia;
    return {
      mensaje: `💰 Encontraste un cofre con *${money(ganancia)}*.`,
      tipo: 'ganar',
    };
  } else if (r < 0.75) {
    // Encuentro neutral
    const encuentros = [
      '🗝️ Encontraste una llave antigua, no sirve para nada pero brilla.',
      '🦴 Encontraste restos de un aventurero anterior.',
      '🕯️ Encendiste una antorcha y el pasillo se ilumina.',
    ];
    return {
      mensaje: pick(encuentros),
      tipo: 'neutral',
    };
  } else if (r < 0.88) {
    // Trampa, pierdes parte de lo ganado
    const perdida = Math.floor(session.ganado * 0.3);
    session.ganado = Math.max(0, session.ganado - perdida);
    if (perdida > 0) {
      return {
        mensaje: `💀 Caíste en una trampa y perdiste *${money(perdida)}*.`,
        tipo: 'trampa',
      };
    }
    return {
      mensaje: '💀 Caíste en una trampa pero no llevabas nada valioso.',
      tipo: 'trampa',
    };
  } else {
    // Monstruo, pierdes todo y termina la sesión
    session.activo = false;
    session.ganado = 0;
    return {
      mensaje: '👹 Un monstruo de la mazmorra te atacó. Perdiste todo lo ganado y la sesión terminó.',
      tipo: 'muerte',
    };
  }
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
  casino: ['work', 'slut', 'crime', 'daily', 'rob', 'pay', 'bal', 'baltop', 'deposit', 'withdraw', 'give', 'take', 'bj', 'blackjack', 'pedir', 'plantarme', 'doblar', 'ruleta', 'rt', 'reset-economy', 'tragamonedas', 'medida', 'match', '8ball'],
  mazmorra: ['mazmorra', 'avanzar', 'retirarse', 'mazmorra-boss'],
  rpg: ['clase', 'armas', 'herrero', 'pescar', 'minar', 'gremio', 'rango', 'npc', 'nombre', 'casa', 'contratar', 'aprendiz', 'misiones', 'mision', 'combate', 'pelear', 'estado', 'dungeon-start', 'cofre', 'bosses', 'skill', 'combinar', 'stats', 'evolucionar', 'habilidades', 'desbloquear', 'domar', 'bestias', 'especial'],
  group: ['tagall', 'tag', 'tagadmin', 'antilink', 'welcome', 'goodbye', 'setwelcome', 'setgoodbye', 'testwelcome', 'texts', 'lobby', 'setform', 'testlobby', 'seguir', 'bienvenido', 'expulsar'],
  admin: ['perm', 'promote', 'demote', 'setup', 'unlock', 'lock', 'resetdaily'],
  utility: ['help', 'info', 'ping', 'stk'],
};

const helpCategoryLabels = {
  casino: '🎰 Casino, Economía y Juegos',
  mazmorra: '🏰 Mazmorra',
  rpg: '🗡️ RPG y Aventura',
  group: '👥 Grupo',
  admin: '🛠️ Administración',
  utility: '⚙️ Utilidad',
};

const helpAllCats = Object.keys(helpCategories);

const OWNER_ONLY = ['give', 'reset-economy'];
const HARD_RESTRICTED = ['give', 'take', 'resetdaily', 'ecolog', 'ecobackup', 'restrict'];
const isRestricted = (cmd) =>
  HARD_RESTRICTED.includes(cmd) || (settings.restrictedCommands || []).includes(cmd);

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
      helpText += `  Ej: ${prefix}sethelp casino,group`;

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
      if (!globalThis._ruletas) globalThis._ruletas = new Map();
      const jid = ctx.jid;
      let g = globalThis._ruletas.get(jid);
      if (!g) {
        g = {
          active: false,
          starter: null,
          bets: new Map(),
          timer: null,
          endTime: 0,
        };
        globalThis._ruletas.set(jid, g);
      }
      const me = getSenderId(ctx);
      const args = ctx.text.slice(config.prefix.length).trim().split(/\s+/).slice(1);
      const sub = args[0] ? args[0].toLowerCase() : '';

      const rouletteTimeout = 30000;
      const announceTimes = [28000, 21000, 14000, 7000];

      const scheduleAnnouncements = () => {
        announceTimes.forEach((msLeft) => {
          const delay = rouletteTimeout - msLeft;
          setTimeout(() => {
            if (!g.active) return;
            const remaining = Math.max(0, g.endTime - Date.now());
            if (remaining <= 0) return;
            sendTo(jid, `\u200E⏳ Quedan *${Math.ceil(remaining / 1000)}s* para apostar en la ruleta.`).catch(() => {});
          }, delay);
        });
      };

      const resolveRuleta = async () => {
        if (!g.active) return;
        g.active = false;
        if (g.timer) { clearTimeout(g.timer); g.timer = null; }

        // Girar ruleta: solo rojo o negro (1-36)
        const winningNum = crypto.randomInt(1, 37);
        const redNums = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
        const winningColor = redNums.has(winningNum) ? 'rojo' : 'negro';

        const lines = [];
        let totalPayout = 0;
        let totalBets = 0;

        for (const [userId, bet] of g.bets) {
          const u = econUser(userId);
          totalBets += bet.amount;
          let won = false;
          let multiplier = 0;
          if (bet.type === 'color' && bet.choice === winningColor) {
            won = true;
            multiplier = 2;
          }
          if (won) {
            const payout = bet.amount * multiplier;
            u.cash += payout;
            totalPayout += payout;
            lines.push(`✅ *${displayName(userId)}* apostó ${money(bet.amount)} a *${bet.choice}* y ganó *${money(payout)}* (x${multiplier})`);
          } else {
            lines.push(`❌ *${displayName(userId)}* apostó ${money(bet.amount)} a *${bet.choice}* y perdió.`);
          }
        }
        markEconDirty();

        const colorEmoji = winningColor === 'rojo' ? '🔴' : '⚫';
        let resultMsg = `\u200E🎯 *Ruleta cerrada*\n\nNúmero ganador: ${colorEmoji} *${winningNum}* (${winningColor})\n\n`;
        if (g.bets.size === 0) {
          resultMsg += `Nadie apostó esta ronda.`;
        } else {
          resultMsg += `${lines.join('\n')}\n\nTotal apostado: *${money(totalBets)}*\nTotal pagado: *${money(totalPayout)}*`;
        }
        try {
          await sendTo(jid, resultMsg);
        } catch (e) {
          console.error('Error enviando resultado ruleta:', e.message);
        } finally {
          g.active = false;
          g.jid = null;
          g.starter = null;
          g.bets = new Map();
          g.timer = null;
          globalThis._ruletas.delete(jid);
        }
      };

      // Si no pone nada, iniciar ronda automáticamente
      if (!sub) {
        if (g.active) return `Ya hay una ruleta abierta en este grupo. Apostá con: #ruleta <rojo|negro> <monto>`;
        g.active = true;
        g.starter = me;
        g.bets = new Map();
        g.endTime = Date.now() + rouletteTimeout;

        await sendTo(
          jid,
          `\u200E🎡 *Ruleta DKS - Ronda abierta!*\n\nApostá con:\n#ruleta rojo <monto>\n#ruleta negro <monto>\n#ruleta red <monto>\n#ruleta black <monto>\nMínimo: *1000 Coins*\n\nTiempo para apostar: *30 segundos*\n¡Buena suerte! 🍀`
        );

        scheduleAnnouncements();
        g.timer = setTimeout(resolveRuleta, rouletteTimeout);
        return null;
      }

      // Detener ronda anticipadamente (solo starter o admin) - devuelve todas las apuestas
      if (sub === 'stop') {
        if (!g.active) return 'No hay ninguna ruleta activa en este grupo.';
        if (me !== g.starter && !(await isGroupAdmin(ctx)) && !isOwner(ctx)) return 'Solo quien inició la ronda o un admin puede detenerla.';
        if (g.timer) { clearTimeout(g.timer); g.timer = null; }
        // Devolver todas las apuestas
        for (const [userId, bet] of g.bets) {
          const u = econUser(userId);
          u.cash += bet.amount;
        }
        markEconDirty();
        g.active = false;
        g.bets = new Map();
        globalThis._ruletas.delete(jid);
        await sendTo(jid, '\u200E🛑 La ruleta fue detenida. Todas las apuestas fueron devueltas.');
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
      if (!g.active) {
        g.active = true;
        g.starter = me;
        g.bets = new Map();
        g.endTime = Date.now() + rouletteTimeout;

        await sendTo(
          jid,
          `\u200E🎡 *Ruleta DKS - Ronda abierta!*\n\nApostá con:\n#ruleta rojo <monto>\n#ruleta negro <monto>\n#ruleta red <monto>\n#ruleta black <monto>\nMínimo: *1000 Coins*\n\nTiempo para apostar: *30 segundos*\n¡Buena suerte! 🍀`
        );

        scheduleAnnouncements();
        g.timer = setTimeout(resolveRuleta, rouletteTimeout);
      }

      // Descontar apuesta una sola vez al apostar
      u.cash = Math.max(0, u.cash - amount);
      markEconDirty();
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
        return 'Ya tenés una partida en curso. Usá #pedir (otra carta), #plantarme (cerrar) o #doblar (duplicar apuesta y una carta).';
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

      // Custodia: descontar apuesta al empezar
      u.cash = Math.max(0, u.cash - bet);
      markEconDirty();

      const deck = buildDeck();
      const player = [deck.pop(), deck.pop()];
      const dealer = [deck.pop(), deck.pop()];
      globalThis._bj[me] = {
        deck, player, dealer, bet,
        started: Date.now(),
        doubled: false,
      };

      const pV = handValue(player);
      if (pV === 21) {
        // Blackjack natural paga 3:2
        const win = Math.floor(bet * 1.5);
        const payout = bet + win;
        u.cash += payout;
        markEconDirty();
        delete globalThis._bj[me];
        writeAuditLog('blackjack', me, me, bet, ctx.jid);
        return ` 🃏 *Blackjack*\n\n *Tú:* ${formatHand(player)} = *21*\n *Apuesta:* *${money(bet)}*\n\n¡BLACKJACK! 🎉 *Ganaste ${money(payout)}* (3:2)`;
      }

      return ` 🃏 *Blackjack DKS*\n\n *Tú:* ${formatHand(player)} = *${pV}*\n *Apuesta:* *${money(bet)}*\n\n *Banca:* ${formatHand([dealer[0]])} 🂠 = *${handValue([dealer[0]])}*\n\n ¿*#pedir* otra carta, te *#plantas* o *#doblar*?`;
    },
  },

  doblar: {
    desc: ' Duplicar apuesta y recibir una carta más en el Blackjack',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      if (!globalThis._bj || !globalThis._bj[me]) return 'No tenés partida en curso. Escribí #bj para comenzar.';
      const game = globalThis._bj[me];
      if (game.doubled) return 'Ya duplicaste tu apuesta en esta partida.';
      if (game.player.length !== 2) return 'Solo podés doblar con las dos cartas iniciales.';
      const u = econUser(me);
      if (u.cash < game.bet) return 'No tienes suficiente dinero para duplicar.';
      u.cash = Math.max(0, u.cash - game.bet);
      game.bet *= 2;
      game.doubled = true;
      markEconDirty();
      game.player.push(game.deck.pop());
      const v = handValue(game.player);
      if (v > 21) {
        delete globalThis._bj[me];
        writeAuditLog('blackjack', me, me, game.bet, ctx.jid);
        return ` 🃏 *Blackjack - Doblado*\n\n *Tú:* ${formatHand(game.player)} = *${v}*\n *Apuesta:* *${money(game.bet)}*\n\n Te pasaste de 21... 💥 *Perdiste ${money(game.bet)}.*`;
      }
      if (v === 21) {
        const res = endBlackjack(me);
        return ` 🃏 *Blackjack - Doblado*\n\n *Tú:* ${formatHand(game.player)} = *21*\n *Apuesta:* *${money(game.bet)}*\n\n ¡21! 🎉\n\n${res}`;
      }
      return ` 🃏 *Blackjack DKS - Doblado*\n\n *Tú:* ${formatHand(game.player)} = *${v}*\n *Apuesta:* *${money(game.bet)}*\n\n *Banca:* ${formatHand([game.dealer[0]])} 🂠 = *${handValue([game.dealer[0]])}*\n\n ¿*#pedir* otra carta o te *#plantas*?`;
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
        delete globalThis._bj[me];
        writeAuditLog('blackjack', me, me, game.bet, ctx.jid);
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

  mazmorra: {
    desc: ' Entrá a la mazmorra. Uso: #mazmorra <apuesta> (mínimo 1000)',
    execute: async (ctx) => {
      if (!globalThis._mazmorra) globalThis._mazmorra = new Map();
      const me = getSenderId(ctx);
      if (globalThis._mazmorra.has(me)) {
        return 'Ya tenés una sesión de mazmorra activa. Usá #avanzar o #retirarse.';
      }
      const u = econUser(me);
      const args = ctx.text.slice(config.prefix.length).trim().split(/\s+/).slice(1);
      const betArg = args[0];
      let bet;
      if (!betArg) return 'Uso: #mazmorra <apuesta> (mínimo 1000 Coins). Ej: #mazmorra 1000';
      if (betArg === 'all' || betArg === 'todo') bet = u.cash;
      else if (/^\d+$/.test(betArg)) bet = parseInt(betArg, 10);
      else return 'Uso: #mazmorra <apuesta> (mínimo 1000 Coins). Ej: #mazmorra 1000';
      if (!bet || bet < 1000) return 'La apuesta mínima es de *1000 Coins*.';
      if (bet > u.cash) return 'No tienes suficiente dinero para entrar.';

      u.cash = Math.max(0, u.cash - bet);
      markEconDirty();

      const session = {
        bet,
        piso: 1,
        ganado: 0,
        activo: true,
        started: Date.now(),
      };
      globalThis._mazmorra.set(me, session);

      const evento = generarEventoMazmorra(session);
      return ` 🏰 *Mazmorra DKS - Piso ${session.piso}*\n *Apuesta:* *${money(bet)}*\n *Ganado hasta ahora:* *${money(session.ganado)}*\n\n${evento.mensaje}\n\nUsá #avanzar para seguir o #retirarse para cobrar.`;
    },
  },

  avanzar: {
    desc: ' Avanza al siguiente piso de la mazmorra',
    execute: async (ctx) => {
      if (!globalThis._mazmorra) return 'No tenés sesión activa. Escribí #mazmorra para entrar.';
      const me = getSenderId(ctx);
      const session = globalThis._mazmorra.get(me);
      if (!session || !session.activo) return 'No tenés una sesión de mazmorra activa. Escribí #mazmorra para entrar.';

      session.piso += 1;
      const u = econUser(me);
      const evento = rpg.generarEventoMazmorra(u);

      if (evento.tipo === 'perder_oro' && u.cash <= 0) {
        session.activo = false;
        session.ganado = 0;
      }

      if (!session.activo) {
        globalThis._mazmorra.delete(me);
        markEconDirty();
        return ` 🏰 *Mazmorra DKS - Piso ${session.piso}*\n\n${evento.mensaje}\n\n💀 *La sesión terminó. Perdiste todo lo ganado.*`;
      }

      markEconDirty();
      return ` 🏰 *Mazmorra DKS - Piso ${session.piso}*\n *Ganado hasta ahora:* *${money(session.ganado)}*\n\n${evento.mensaje}\n\nUsá #avanzar para seguir o #retirarse para cobrar.`;
    },
  },

  retirarse: {
    desc: ' Sale de la mazmorra con lo ganado',
    execute: async (ctx) => {
      if (!globalThis._mazmorra) return 'No tenés sesión activa.';
      const me = getSenderId(ctx);
      const session = globalThis._mazmorra.get(me);
      if (!session || !session.activo) return 'No tenés una sesión de mazmorra activa.';

      const u = econUser(me);
      u.cash += session.ganado;
      markEconDirty();
      globalThis._mazmorra.delete(me);

      return ` 🏰 *Mazmorra DKS - Retirada*\n *Pisos superados:* ${session.piso - 1}\n *Ganado:* *${money(session.ganado)}*\n *Total recuperado:* *${money(session.ganado)}*`;
    },
  },

  'mazmorra-boss': {
    desc: ' Enfrenta al jefe de la mazmorra (solo cada 10 pisos). Uso: #mazmorra-boss',
    execute: async (ctx) => {
      if (!globalThis._mazmorraBoss) globalThis._mazmorraBoss = new Map();
      const me = getSenderId(ctx);
      if (globalThis._mazmorraBoss.has(me)) {
        return 'Ya estás en un combate contra el jefe. Usá #pelear-boss para atacar.';
      }
      const u = econUser(me);
      rpg.ensureRPG(u);

      if (!u.rpg.clase) {
        return 'Necesitas elegir una clase con #clase antes de enfrentar al jefe.';
      }

      const pisoBoss = 10;
      const bossHp = 500;
      const bossAtk = 25;
      const bossNombre = '🐉 Señor de la Mazmorra';

      globalThis._mazmorraBoss.set(me, {
        hp: bossHp,
        maxHp: bossHp,
        atk: bossAtk,
        nombre: bossNombre,
        turnos: 0,
        recompensa: 15000,
        exp: 300,
      });

      markEconDirty();

      return ` 🏰 *Mazmorra DKS - Jefe Apareció!*\n\n *Enemigo:* ${bossNombre}\n *HP:* ${bossHp}/${bossHp}\n *ATK:* ${bossAtk}\n\n ¡Un poderoso jefe bloquea tu camino al piso ${pisoBoss}!\n Usá #pelear-boss para atacar.\n ¡Derrotalo para obtener ${money(15000)} y 300 EXP!`;
    },
  },

  'pelear-boss': {
    desc: ' Ataca al jefe de la mazmorra en combate actual.',
    execute: async (ctx) => {
      if (!globalThis._mazmorraBoss) return 'No hay combate de jefe activo.';
      const me = getSenderId(ctx);
      const boss = globalThis._mazmorraBoss.get(me);
      if (!boss) return 'No estás en un combate contra el jefe. Usá #mazmorra-boss para iniciar.';

      const u = econUser(me);
      rpg.ensureRPG(u);
      const clase = rpg.CLASSES[u.rpg.clase] || { atkBase: 10, defBase: 5 };
      const arma = rpg.WEAPONS[u.rpg.arma] || { atk: 0 };

      boss.turnos += 1;

      // Daño del jugador
      const dmgJugador = Math.max(1, clase.atkBase + arma.atk + Math.floor(Math.random() * 6) - 2);
      boss.hp = Math.max(0, boss.hp - dmgJugador);

      let texto = `⚔️ *Combate contra ${boss.nombre}*\n`;
      texto += `Atacaste e infligiste *${dmgJugador}* de daño.\n`;
      texto += `HP del jefe: ${boss.hp}/${boss.maxHp}\n`;

      if (boss.hp <= 0) {
        // Victoria
        u.cash += boss.recompensa;
        u.rpg.exp += boss.exp;
        // Subir nivel si es necesario
        while (u.rpg.exp >= u.rpg.nivel * 100) {
          u.rpg.exp -= u.rpg.nivel * 100;
          u.rpg.nivel += 1;
        }
        globalThis._mazmorraBoss.delete(me);
        markEconDirty();
        writeAuditLog('mazmorra-boss', me, me, boss.recompensa, ctx.jid);
        texto += `\n💀 *¡Derrotaste al jefe!*\n💰 Ganaste ${money(boss.recompensa)}\n⭐ Ganaste ${boss.exp} EXP\n🏆 ¡Puedes continuar al siguiente piso de la mazmorra!`;
        return texto;
      }

      // El jefe contraataca
      const dmgBoss = Math.max(1, boss.atk + Math.floor(Math.random() * 6) - 3);
      const defensa = clase.defBase || 0;
      const dmgFinal = Math.max(0, dmgBoss - defensa);

      // Usar oro como "vida" temporal o simplemente registrar daño
      // Restamos una pequeña cantidad de oro como "costo de curación" o simplemente avisamos
      texto += `👹 ${boss.nombre} te contraataca e inflige *${dmgFinal}* de daño.\n`;
      texto += `Turnos: ${boss.turnos}\n`;

      if (boss.turnos >= 15) {
        // Derrota por tiempo o demasiados turnos
        const penalidad = Math.floor(u.cash * 0.2);
        u.cash = Math.max(0, u.cash - penalidad);
        globalThis._mazmorraBoss.delete(me);
        markEconDirty();
        texto += `\n⏰ El jefe te venció tras ${boss.turnos} turnos.\n💸 Perdiste ${money(penalidad)} en la huida.`;
        return texto;
      }

      markEconDirty();
      texto += `\nUsá #pelear-boss para seguir atacando.`;
      return texto;
    },
  },

  cofre: {
    desc: ' Abre un cofre del tesoro. Uso: #cofre <comun|raro|epico|legendario>',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      rpg.ensureRPG(u);
      const args = ctx.text.slice(config.prefix.length).trim().split(/\s+/).slice(1);
      const clave = args[0] ? args[0].toLowerCase() : '';

      if (!rpg.CHESTS[clave]) {
        return `Cofres disponibles:\n${Object.entries(rpg.CHESTS).map(([k, c]) => `• ${c.nombre} - ${money(c.costo)}`).join('\n')}\nUso: #cofre <clave>`;
      }

      const resultado = rpg.openChest(u, clave);
      if (resultado.error) return resultado.error;

      markEconDirty();
      writeAuditLog('cofre', me, clave, resultado.costo, ctx.jid);

      if (resultado.tipo === 'trampa') {
        return `📦 *${rpg.CHESTS[clave].nombre}*\n\n${resultado.mensaje}\nCosto: ${money(resultado.costo)}\nPerdido: ${money(resultado.perdida)}\nSaldo: ${money(u.cash)}`;
      }

      return `📦 *${rpg.CHESTS[clave].nombre}*\n\n${resultado.mensaje}\nCosto: ${money(resultado.costo)}\nGanado: ${money(resultado.ganancia)}\nSaldo: ${money(u.cash)}`;
    },
  },

  bosses: {
    desc: ' Ver jefes disponibles para enfrentar. Uso: #bosses',
    execute: async (ctx) => {
      const u = econUser(getSenderId(ctx));
      rpg.ensureRPG(u);
      let txt = `👹 *Jefes de la Mazmorra*\n\n`;
      for (const [key, b] of Object.entries(rpg.BOSSSES)) {
        const puede = u.rpg.nivel >= b.dificultad ? '✅' : '🔒';
        txt += `${puede} *${b.nombre}*\n   HP: ${b.hp} | ATK: ${b.atk} | Recompensa: ${money(b.oro)} | EXP: ${b.exp} | Dificultad: ${b.dificultad}\n`;
      }
      txt += `\nUsá #mazmorra-boss <clave> para enfrentar a un jefe.`;
      return txt;
    },
  },

  'mazmorra-boss': {
    desc: ' Enfrenta a un jefe de la mazmorra. Uso: #mazmorra-boss <clave>',
    execute: async (ctx) => {
      if (!globalThis._mazmorraBoss) globalThis._mazmorraBoss = new Map();
      const me = getSenderId(ctx);
      if (globalThis._mazmorraBoss.has(me)) {
        return 'Ya estás en un combate contra un jefe. Usá #pelear-boss para atacar.';
      }
      const u = econUser(me);
      rpg.ensureRPG(u);
      const args = ctx.text.slice(config.prefix.length).trim().split(/\s+/).slice(1);
      const clave = args[0] ? args[0].toLowerCase() : '';

      if (!rpg.BOSSSES[clave]) {
        return `Jefes disponibles: ${Object.keys(rpg.BOSSSES).join(', ')}\nUsá #bosses para ver detalles.`;
      }

      const bossData = rpg.BOSSSES[clave];
      if (u.rpg.nivel < bossData.dificultad) {
        return `Necesitas nivel ${bossData.dificultad} para enfrentar a *${bossData.nombre}*. Tu nivel: ${u.rpg.nivel}.`;
      }

      globalThis._mazmorraBoss.set(me, {
        hp: bossData.hp,
        maxHp: bossData.hp,
        atk: bossData.atk,
        nombre: bossData.nombre,
        turnos: 0,
        recompensa: bossData.oro,
        exp: bossData.exp,
        clave,
      });

      markEconDirty();

      return ` 🏰 *Mazmorra DKS - Jefe Apareció!*\n\n *Enemigo:* ${bossData.nombre}\n *HP:* ${bossData.hp}/${bossData.hp}\n *ATK:* ${bossData.atk}\n *Recompensa:* ${money(bossData.oro)} | ${bossData.exp} EXP\n\n ¡Un poderoso jefe bloquea tu camino!\n Usá #pelear-boss para atacar.`;
    },
  },

  'pelear-boss': {
    desc: ' Ataca al jefe de la mazmorra en combate actual.',
    execute: async (ctx) => {
      if (!globalThis._mazmorraBoss) return 'No hay combate de jefe activo.';
      const me = getSenderId(ctx);
      const boss = globalThis._mazmorraBoss.get(me);
      if (!boss) return 'No estás en un combate contra el jefe. Usá #mazmorra-boss <clave> para iniciar.';

      const u = econUser(me);
      rpg.ensureRPG(u);
      const clase = rpg.CLASSES[u.rpg.clase] || { atkBase: 10, defBase: 5 };
      const arma = rpg.WEAPONS[u.rpg.arma] || { atk: 0 };

      boss.turnos += 1;

      // Daño del jugador
      const dmgJugador = Math.max(1, clase.atkBase + arma.atk + Math.floor(Math.random() * 6) - 2);
      boss.hp = Math.max(0, boss.hp - dmgJugador);

      let texto = `⚔️ *Combate contra ${boss.nombre}*\n`;
      texto += `Atacaste e infligiste *${dmgJugador}* de daño.\n`;
      texto += `HP del jefe: ${boss.hp}/${boss.maxHp}\n`;

      if (boss.hp <= 0) {
        // Victoria
        u.cash += boss.recompensa;
        u.rpg.exp += boss.exp;
        while (u.rpg.exp >= u.rpg.nivel * 100) {
          u.rpg.exp -= u.rpg.nivel * 100;
          u.rpg.nivel += 1;
        }
        globalThis._mazmorraBoss.delete(me);
        markEconDirty();
        writeAuditLog('mazmorra-boss', me, me, boss.recompensa, ctx.jid);
        texto += `\n💀 *¡Derrotaste al jefe!*\n💰 Ganaste ${money(boss.recompensa)}\n⭐ Ganaste ${boss.exp} EXP\n🏆 ¡Puedes continuar en la mazmorra!`;
        return texto;
      }

      // El jefe contraataca
      const dmgBoss = Math.max(1, boss.atk + Math.floor(Math.random() * 6) - 3);
      const defensa = clase.defBase || 0;
      const dmgFinal = Math.max(0, dmgBoss - defensa);

      texto += `👹 ${boss.nombre} te contraataca e inflige *${dmgFinal}* de daño.\n`;
      texto += `Turnos: ${boss.turnos}\n`;

      if (boss.turnos >= 15) {
        const penalidad = Math.floor(u.cash * 0.2);
        u.cash = Math.max(0, u.cash - penalidad);
        globalThis._mazmorraBoss.delete(me);
        markEconDirty();
        texto += `\n⏰ El jefe te venció tras ${boss.turnos} turnos.\n💸 Perdiste ${money(penalidad)} en la huida.`;
        return texto;
      }

      markEconDirty();
      texto += `\nUsá #pelear-boss para seguir atacando.`;
      return texto;
    },
  },

  skill: {
    desc: ' Usa una habilidad de tu clase. Uso: #skill <nombre>',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      rpg.ensureRPG(u);

      if (!u.rpg.clase) {
        return 'No tienes una clase seleccionada. Usá #clase <guerrero|mago|arquero|pícaro>.';
      }

      const claseSkills = rpg.SKILLS[u.rpg.clase];
      const args = ctx.text.slice(config.prefix.length).trim().split(/\s+/).slice(1);
      const skillKey = args[0] ? args[0].toLowerCase() : '';

      if (!skillKey) {
        let txt = `🎯 *Habilidades de ${rpg.classLabel(u.rpg.clase)}*\n\n`;
        for (const [key, s] of Object.entries(claseSkills)) {
          txt += `• *${s.nombre}* - ${s.descripcion}\n   Costo: ${money(s.costo)}\n`;
        }
        txt += `\nUsá #skill <nombre> para usar una.`;
        return txt;
      }

      const skill = claseSkills[skillKey];
      if (!skill) {
        return `Habilidad no encontrada. Disponibles: ${Object.keys(claseSkills).join(', ')}.`;
      }

      const resultado = rpg.useSkill(u, skillKey);
      if (resultado.error) return resultado.error;

      markEconDirty();
      writeAuditLog('skill', me, skillKey, resultado.costo, ctx.jid);

      let txt = `✨ Usaste *${skill.nombre}*!\n${skill.descripcion}\nCosto: ${money(resultado.costo)}\n`;

      if (skill.multiplicador) {
        txt += `🔥 Multiplicador de daño: x${skill.multiplicador} en tu próximo ataque.`;
      }
      if (skill.reduccion) {
        txt += `🛡️ Reducción de daño: ${Math.round(skill.reduccion * 100)}% en el próximo turno enemigo.`;
      }
      if (skill.curacion) {
        txt += `❤️ Te curas ${skill.curacion} puntos de vida.`;
      }
      if (skill.evadir) {
        txt += `🌀 ${Math.round(skill.evadir * 100)}% de probabilidad de esquivar el próximo ataque.`;
      }
      if (skill.roba_oro) {
        txt += `💰 Robas oro al enemigo en tu próximo ataque.`;
      }
      if (skill.bloquear) {
        txt += `🫥 Bloqueas todo el daño del próximo turno enemigo.`;
      }

      return txt;
    },
  },

  combinar: {
    desc: ' Combina dos habilidades de tu clase para crear una nueva. Uso: #combinar <skill1> <skill2>',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      rpg.ensureRPG(u);
      const args = ctx.text.slice(config.prefix.length).trim().split(/\s+/).slice(1);
      const key1 = args[0] ? args[0].toLowerCase() : '';
      const key2 = args[1] ? args[1].toLowerCase() : '';

      if (!key1 || !key2) {
        let txt = `🔧 *Combinar Habilidades*\n\nUso: #combinar <skill1> <skill2>\n\nCombinaciones disponibles para tu clase:\n`;
        if (u.rpg.clase && rpg.COMBINACIONES_SKILLS) {
          for (const [key, comb] of Object.entries(rpg.COMBINACIONES_SKILLS)) {
            if (comb.clases.includes(u.rpg.clase)) {
              txt += `• ${key1 === comb.skill1 ? comb.skill1 + '+' + comb.skill2 : comb.skill2 + '+' + comb.skill1} → ${comb.nombre} (${money(comb.costo)})\n`;
            }
          }
        }
        txt += `\nEjemplo: #combinar golpe_fuerte escudo`;
        return txt;
      }

      const resultado = rpg.combinarSkills(u, key1, key2);
      if (resultado.error) return resultado.error;

      markEconDirty();
      writeAuditLog('combinar', me, `${key1}+${key2}`, 0, ctx.jid);

      return resultado.mensaje;
    },
  },

  stats: {
    desc: ' Ver tus estadísticas de aventurero completo.',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      const s = rpg.getStats(u);

      let txt = `👤 *Estadísticas de Aventurero*\n\n`;
      txt += `📛 Nombre: *${s.nombrePersonalizado}*\n`;
      txt += `🛡️ Clase: *${s.clase}*\n`;
      txt += `⭐ Nivel: *${s.nivel}* (EXP: ${s.exp}/${s.expSiguiente})\n`;
      txt += `⚔️ ATK: *${s.atk}* | 🛡️ DEF: *${s.def}* | ❤️ HP: *${s.hp}*\n`;
      txt += `💰 Efectivo: ${money(s.cash)} | 🏦 Banco: ${money(s.bank)} | 🪙 Oro RPG: ${money(s.oro)}\n`;
      txt += `🏠 Casa: *${s.casa}* | 🏰 Gremio: *${s.gremio}*\n`;

      if (s.habilidades && s.habilidades.length > 0) {
        txt += `\n✨ Habilidades Combinadas:\n`;
        for (const h of s.habilidades) {
          txt += `• ${h}\n`;
        }
      }

      if (s.misionesCompletadas && s.misionesCompletadas.length > 0) {
        txt += `\n🏆 Misiones Completadas: ${s.misionesCompletadas.length}`;
      }

      return txt;
    },
  },

  evolucionar: {
    desc: ' Evoluciona tu clase a su forma superior. Uso: #evolucionar <clase>',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      rpg.ensureRPG(u);
      const args = ctx.text.slice(config.prefix.length).trim().split(/\s+/).slice(1);
      const nuevaClave = args[0] ? args[0].toLowerCase() : '';

      if (!nuevaClave) {
        const evo = rpg.EVOLUCIONES_CLASE[u.rpg.clase];
        if (!evo) return 'Tu clase no tiene evolución disponible.';
        return `🔄 Evolución disponible:\nDe: ${rpg.classLabel(u.rpg.clase)}\nA: ${rpg.classLabel(evo.nombre)}\nNivel requerido: ${evo.requisito} (tu nivel: ${u.rpg.nivel})\nCosto: Gratis\nUsá: #evolucionar ${evo.nombre}`;
      }

      const resultado = rpg.evolucionarClase(u, nuevaClave);
      if (resultado.error) return resultado.error;

      markEconDirty();
      return `${resultado.mensaje}\n${rpg.NUEVAS_CLASES[nuevaClave].desc}`;
    },
  },

  habilidades: {
    desc: ' Ver habilidades desbloqueables por tu nivel. Uso: #habilidades',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      rpg.ensureRPG(u);

      if (!u.rpg.clase) return 'No tienes una clase seleccionada. Usá #clase primero.';

      const disponibles = rpg.obtenerHabilidadesNivel(u);
      if (disponibles.length === 0) return 'No hay habilidades disponibles para tu nivel actual.';

      let txt = `📚 *Habilidades disponibles (Nivel ${u.rpg.nivel}):*\n\n`;
      for (const h of disponibles) {
        txt += `• *${h.nombre}* (Nivel ${h.nivel}) - ${money(h.costo)}\n`;
      }
      txt += `\nUsá: #desbloquear <clave>\nEjemplo: #desbloquear golpe_fuerte`;
      return txt;
    },
  },

  desbloquear: {
    desc: ' Desbloquea una habilidad por nivel. Uso: #desbloquear <clave>',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      rpg.ensureRPG(u);
      const args = ctx.text.slice(config.prefix.length).trim().split(/\s+/).slice(1);
      const key = args[0] ? args[0].toLowerCase() : '';

      if (!key) return 'Uso: #desbloquear <clave>';

      const resultado = rpg.desbloquearHabilidadPorNivel(u, key);
      if (resultado.error) return resultado.error;

      markEconDirty();
      return `✅ Habilidad desbloqueada: *${resultado.habilidad.nombre}*\n${resultado.habilidad.descripcion}\nNivel requerido: ${resultado.habilidad.nivel}`;
    },
  },

  domar: {
    desc: ' Domar una bestia para invocarla en combate. Uso: #domar <bestia>',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      rpg.ensureRPG(u);

      if (!u.rpg.clase || u.rpg.clase !== 'invocador') {
        return 'Solo los Invocadores pueden domar bestias. Usá #clase invocador.';
      }

      const args = ctx.text.slice(config.prefix.length).trim().split(/\s+/).slice(1);
      const bestia = args[0] ? args[0].toLowerCase() : '';

      if (!bestia) {
        return `Bestias disponibles para domar:\n• lobo (nivel 5)\n• esqueleto (nivel 10)\n• jabali (nivel 15)\nUsá: #domar <bestia>`;
      }

      if (!u.rpg.bestiasDomadas) u.rpg.bestiasDomadas = [];
      if (u.rpg.bestiasDomadas.includes(bestia)) return `Ya domaste a ${bestia}.`;

      const nivelesReq = { lobo: 5, esqueleto: 10, jabali: 15 };
      if (u.rpg.nivel < nivelesReq[bestia]) {
        return `Necesitas nivel ${nivelesReq[bestia]} para domar a ${bestia}.`;
      }

      const costo = 1000;
      if (u.cash < costo) return `No tienes suficiente dinero. Costo: ${money(costo)}.`;

      u.cash = Math.max(0, u.cash - costo);
      u.rpg.bestiasDomadas.push(bestia);
      markEconDirty();

      return `🐺 ¡Has domado a ${bestia}! Ahora puedes invocarla en combate con #invocar ${bestia}.`;
    },
  },

  bestias: {
    desc: ' Ver tus bestias domadas. Uso: #bestias',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      rpg.ensureRPG(u);

      if (!u.rpg.bestiasDomadas || u.rpg.bestiasDomadas.length === 0) {
        return 'No tienes bestias domadas. Usá #domar <bestia> (solo Invocador).';
      }

      let txt = `🐾 *Tus Bestias Domadas*\n\n`;
      for (const b of u.rpg.bestiasDomadas) {
        txt += `• ${b}\n`;
      }
      txt += `\nUsá: #invocar <bestia> en combate.`;
      return txt;
    },
  },

  especial: {
    desc: ' Ver tu habilidad especial por nivel (cada 10 niveles). Uso: #especial',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      rpg.ensureRPG(u);

      if (!u.rpg.nivel) return 'No tienes nivel de clase.';

      const especial = rpg.obtenerHabilidadEspecial(u.rpg.nivel);
      if (!especial) {
        const proximo = Math.ceil(u.rpg.nivel / 10) * 10;
        return `Tu próxima habilidad especial estará disponible en el nivel ${proximo}.`;
      }

      let txt = `⭐ *Habilidad Especial (Nivel ${u.rpg.nivel})*\n\n`;
      txt += `• *${especial.nombre}*\n${especial.descripcion}\nCosto: ${money(especial.costo)}\n`;
      txt += `\nUsá: #usar-especial ${especial.key}`;
      return txt;
    },
  },

  clase: {
    desc: ' Elige tu clase de aventurero. Uso: #clase <guerrero|mago|arquero|pícaro>',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      rpg.ensureRPG(u);
      const args = ctx.text.slice(config.prefix.length).trim().split(/\s+/).slice(1);
      const clase = args[0] ? args[0].toLowerCase() : '';
      if (!rpg.CLASSES[clase]) {
        return `Clases disponibles: ${Object.keys(rpg.CLASSES).join(', ')}`;
      }
      if (u.rpg.clase) return `Ya tienes la clase *${rpg.classLabel(u.rpg.clase)}*.`;
      u.rpg.clase = clase;
      u.rpg.nivel = 1;
      u.rpg.exp = 0;
      markEconDirty();
      return `✅ ¡Eres ahora *${rpg.classLabel(clase)}*! ${rpg.CLASSES[clase].desc}`;
    },
  },

  armas: {
    desc: ' Ver tus armas equipadas y disponibles. Uso: #armas',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      rpg.ensureRPG(u);
      const equipada = rpg.weaponLabel(u.rpg.arma);
      const lista = u.rpg.armas.map((a) => `• ${rpg.weaponLabel(a)}`).join('\n');
      return `🗡️ *Tus Armas*\nEquipada: *${equipada}*\n${lista}`;
    },
  },

  herrero: {
    desc: ' Forjar o mejorar armas. Uso: #herrero forjar <arma> | #herrero mejorar <arma>',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      rpg.ensureRPG(u);
      const args = ctx.text.slice(config.prefix.length).trim().split(/\s+/).slice(1);
      const accion = args[0] ? args[0].toLowerCase() : '';
      const arma = args[1] ? args[1].toLowerCase() : '';

      if (!rpg.WEAPONS[arma]) return 'Arma no válida. Disponibles: ' + Object.keys(rpg.WEAPONS).filter((k) => k !== 'nada').join(', ');

      if (accion === 'forjar') {
        const w = rpg.WEAPONS[arma];
        if (u.rpg.armas.includes(arma)) return 'Ya tienes esta arma.';
        if (u.cash < w.precio) return `No tienes suficiente dinero. Precio: ${money(w.precio)}`;
        u.cash = Math.max(0, u.cash - w.precio);
        u.rpg.armas.push(arma);
        markEconDirty();
        return `✅ Forjaste *${w.nombre}* por ${money(w.precio)}.`;
      }

      if (accion === 'mejorar') {
        if (!u.rpg.armas.includes(arma)) return 'No tienes esa arma.';
        const w = rpg.WEAPONS[arma];
        const costo = Math.floor(w.precio * 0.5);
        if (u.cash < costo) return `No tienes suficiente dinero. Costo de mejora: ${money(costo)}`;
        // Mejora: subir atk en 2
        const mejorada = arma + '_mejorada';
        if (!rpg.WEAPONS[mejorada]) {
          rpg.WEAPONS[mejorada] = { nombre: w.nombre + ' +', atk: w.atk + 2, precio: w.precio * 2 };
        }
        u.cash = Math.max(0, u.cash - costo);
        const idx = u.rpg.armas.indexOf(arma);
        u.rpg.armas[idx] = mejorada;
        if (u.rpg.arma === arma) u.rpg.arma = mejorada;
        markEconDirty();
        return `✨ Mejoraste *${w.nombre}* a *${rpg.WEAPONS[mejorada].nombre}* por ${money(costo)}.`;
      }

      return 'Uso: #herrero forjar <arma> | #herrero mejorar <arma>';
    },
  },

  pescar: {
    desc: ' Pescar para ganar monedas o objetos. Uso: #pescar (tiene espera)',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      rpg.ensureRPG(u);
      const left = rpgLeft(u, 'pescar', 3 * 60 * 1000);
      if (left > 0) return fmtCooldownMsg(left, 'pescar');
      const r = Math.random();
      let ganancia = 0;
      let mensaje = '';
      if (r < 0.6) {
        ganancia = rand(200, 800);
        u.cash += ganancia;
        mensaje = `🎣 Pescaste un pez y lo vendiste por ${money(ganancia)}.`;
      } else if (r < 0.85) {
        ganancia = rand(500, 1500);
        u.cash += ganancia;
        mensaje = `🎣 Pescaste un pez dorado y lo vendiste por ${money(ganancia)}.`;
      } else {
        mensaje = '🎣 No pescaste nada esta vez.';
      }
      rpgCdSet(u, 'pescar');
      markEconDirty();
      return mensaje;
    },
  },

  minar: {
    desc: ' Minar minerales para vender. Uso: #minar (tiene espera)',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      rpg.ensureRPG(u);
      const left = rpgLeft(u, 'minar', 4 * 60 * 1000);
      if (left > 0) return fmtCooldownMsg(left, 'minar');
      const r = Math.random();
      let ganancia = 0;
      let mensaje = '';
      if (r < 0.6) {
        ganancia = rand(300, 1000);
        u.cash += ganancia;
        u.rpg.minerales += ganancia;
        mensaje = `⛏️ Minaste mineral y lo vendiste por ${money(ganancia)}.`;
      } else if (r < 0.85) {
        ganancia = rand(800, 2000);
        u.cash += ganancia;
        u.rpg.minerales += ganancia;
        mensaje = `⛏️ Encontraste una veta rica y la vendiste por ${money(ganancia)}.`;
      } else {
        mensaje = '⛏️ No encontraste nada valioso.';
      }
      rpgCdSet(u, 'minar');
      markEconDirty();
      return mensaje;
    },
  },

  gremio: {
    desc: ' Gremio: crear, unirse o ver info. Uso: #gremio <crear|unirse|ver> <nombre>',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      rpg.ensureRPG(u);
      rpg.ensureGuild(settings);
      const args = ctx.text.slice(config.prefix.length).trim().split(/\s+/).slice(1);
      const accion = args[0] ? args[0].toLowerCase() : '';
      const nombre = args.slice(1).join(' ');

      if (accion === 'crear') {
        if (!nombre) return 'Uso: #gremio crear <nombre>';
        if (u.rpg.gremio) return 'Ya estás en un gremio.';
        for (const gid of Object.keys(settings.guilds)) {
          const g = settings.guilds[gid];
          if (g.miembros.includes(me)) return 'Ya estás en un gremio.';
        }
        if (u.cash < 10000) return 'Cuesta ¥10,000 crear un gremio.';
        u.cash = Math.max(0, u.cash - 10000);
        const gid = 'g_' + Date.now();
        settings.guilds[gid] = { nombre, lider: me, miembros: [me], creado: Date.now() };
        u.rpg.gremio = gid;
        markEconDirty();
        saveSettings();
        return `✅ Gremio *${nombre}* creado. Eres el líder.`;
      }

      if (accion === 'unirse') {
        if (!nombre) return 'Uso: #gremio unirse <nombre>';
        if (u.rpg.gremio) return 'Ya estás en un gremio.';
        let encontrado = null;
        for (const gid of Object.keys(settings.guilds)) {
          if (settings.guilds[gid].nombre.toLowerCase() === nombre.toLowerCase()) {
            encontrado = gid;
            break;
          }
        }
        if (!encontrado) return 'Gremio no encontrado.';
        settings.guilds[encontrado].miembros.push(me);
        u.rpg.gremio = encontrado;
        markEconDirty();
        saveSettings();
        return `✅ Te uniste al gremio *${settings.guilds[encontrado].nombre}*.`;
      }

      if (accion === 'ver') {
        if (!u.rpg.gremio) return 'No estás en un gremio.';
        const g = settings.guilds[u.rpg.gremio];
        if (!g) return 'Tu gremio ya no existe.';
        const rank = rpg.getGuildRank(u.rpg.oro || 0);
        return `🏰 *Gremio: ${g.nombre}*\nLíder: ${rpg.classLabel(g.lider) ? '' : ''}\nMiembros: ${g.miembros.length}\nTu rango: *${rank.nombre}*`;
      }

      return 'Uso: #gremio <crear|unirse|ver> <nombre>';
    },
  },

  rango: {
    desc: ' Ver tu rango en el gremio.',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      rpg.ensureRPG(u);
      if (!u.rpg.gremio) return 'No estás en un gremio.';
      const g = settings.guilds && settings.guilds[u.rpg.gremio];
      if (!g) return 'Tu gremio ya no existe.';
      const rank = rpg.getGuildRank(u.rpg.oro || 0);
      return `🏅 *Rango en ${g.nombre}:* *${rank.nombre}* (Oro: ${money(u.rpg.oro || 0)})`;
    },
  },

  npc: {
    desc: ' Hablar con NPCs de la ciudad. Uso: #npc <herrero|posadero|comerciante>',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const args = ctx.text.slice(config.prefix.length).trim().split(/\s+/).slice(1);
      const tipo = args[0] ? args[0].toLowerCase() : '';
      if (tipo === 'herrero') return '⚒️ Herrero: "Puedo forjar y mejorar tus armas. Usa #herrero".';
      if (tipo === 'posadero') return '🏨 Posadero: "Descansa en la posada por ¥500 y recupera energía.".';
      if (tipo === 'comerciante') return '🛒 Comerciante: "Vendo objetos mágicos. Pronto tendré más stock.".';
      return 'NPCs disponibles: herrero, posadero, comerciante.';
    },
  },

  nombre: {
    desc: ' Establece tu nombre de aventurero. Uso: #nombre <tu nombre>',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      rpg.ensureRPG(u);
      const args = ctx.text.slice(config.prefix.length).trim().split(/\s+/).slice(1);
      const nombre = args.join(' ');
      if (!nombre) return 'Uso: #nombre <tu nombre>';
      if (nombre.length > 30) return 'El nombre es muy largo (máximo 30 caracteres).';
      u.rpg.nombrePersonalizado = nombre;
      markEconDirty();
      return `✅ Nombre de aventurero establecido: *${nombre}*.`;
    },
  },

  casa: {
    desc: ' Compra una casa con beneficios. Uso: #casa <choza|cabaña|casa|mansión|castillo>',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      rpg.ensureRPG(u);
      const args = ctx.text.slice(config.prefix.length).trim().split(/\s+/).slice(1);
      const key = args[0] ? args[0].toLowerCase() : '';
      const house = rpg.getHouseBenefit(key);
      if (!house) return 'Casas disponibles: ' + Object.keys(rpg.HOUSES).join(', ');
      if (u.rpg.casa) return `Ya tienes una casa: *${rpg.getHouseBenefit(u.rpg.casa).nombre}*.`;
      if (u.cash < house.precio) return `No tienes suficiente dinero. Precio: ${money(house.precio)}`;
      u.cash = Math.max(0, u.cash - house.precio);
      u.rpg.casa = key;
      markEconDirty();
      return `✅ Compraste *${house.nombre}* por ${money(house.precio)}.`;
    },
  },

  contratar: {
    desc: ' Contrata un aventurero para trabajar por ti. Uso: #contratar',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      rpg.ensureRPG(u);
      const costo = 5000;
      if (u.rpg.aventureros.length >= 3) return 'Ya tienes la cantidad máxima de aventureros (3).';
      if (u.cash < costo) return `No tienes suficiente dinero. Costo: ${money(costo)}.`;
      u.cash = Math.max(0, u.cash - costo);
      const aventurero = { nombre: 'Aventurero #' + (u.rpg.aventureros.length + 1), contratado: Date.now() };
      u.rpg.aventureros.push(aventurero);
      markEconDirty();
      return `🤝 Contrataste a *${aventurero.nombre}* por ${money(costo)}.`;
    },
  },

  aprendiz: {
    desc: ' Forma un aprendiz para ayudarte. Uso: #aprendiz',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      rpg.ensureRPG(u);
      const costo = 10000;
      if (u.rpg.aprendiz) return 'Ya tienes un aprendiz.';
      if (u.cash < costo) return `No tienes suficiente dinero. Costo: ${money(costo)}.`;
      u.cash = Math.max(0, u.cash - costo);
      u.rpg.aprendiz = { nombre: 'Aprendiz', contratado: Date.now(), nivel: 1 };
      markEconDirty();
      return `👦 Formaste a un *Aprendiz* por ${money(costo)}.`;
    },
  },

  misiones: {
    desc: ' Ver misiones disponibles. Uso: #misiones',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      rpg.ensureRPG(u);
      const disponibles = rpg.getAvailableMissions(u.rpg.nivel);
      let txt = `📋 *Misiones disponibles (Nivel ${u.rpg.nivel}):*\n\n`;
      for (const m of disponibles) {
        const yaActiva = u.rpg.misiones[m.key] ? ' (activa)' : '';
        txt += `• *${m.nombre}* — ${m.objetivo}\n   💰 ${money(m.recompensa)} | ⭐ ${m.exp} EXP | Dificultad ${m.dificultad}${yaActiva}\n`;
      }
      if (Object.keys(u.rpg.misiones).length > 0) {
        txt += `\n📌 *Misiones activas:*\n`;
        for (const [k, m] of Object.entries(u.rpg.misiones)) {
          txt += `• ${k}: progreso ${m.progreso}\n`;
        }
      }
      return txt;
    },
  },

  mision: {
    desc: ' Aceptar una misión. Uso: #mision <clave>',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      rpg.ensureRPG(u);
      const args = ctx.text.slice(config.prefix.length).trim().split(/\s+/).slice(1);
      const clave = args[0] ? args[0].toLowerCase() : '';
      if (!clave) return 'Uso: #mision <clave>';
      const m = rpg.startMission(u, clave);
      if (!m) return 'No se pudo aceptar esa misión (ya la tienes o no existe).';
      markEconDirty();
      return `📜 Misión aceptada: *${m.nombre}*\nObjetivo: ${m.objetivo}\nRecompensa: ${money(m.recompensa)} + ${m.exp} EXP`;
    },
  },

  combate: {
    desc: ' Inicia un combate contra un enemigo. Uso: #combate <enemigo>',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      rpg.ensureRPG(u);
      if (u.rpg.combate) return 'Ya estás en un combate. Usá #pelear para atacar.';
      const args = ctx.text.slice(config.prefix.length).trim().split(/\s+/).slice(1);
      const clave = args[0] ? args[0].toLowerCase() : '';
      if (!rpg.ENEMIES[clave]) {
        return `Enemigos disponibles: ${Object.keys(rpg.ENEMIES).join(', ')}`;
      }
      const enemy = rpg.startCombat(u, clave);
      markEconDirty();
      return `⚔️ *Combate iniciado contra ${enemy.nombre}*\nHP enemigo: ${enemy.hp}/${enemy.hp}\nUsá #pelear para atacar.`;
    },
  },

  pelear: {
    desc: ' Ataca en el combate actual. Uso: #pelear',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      rpg.ensureRPG(u);
      if (!u.rpg.combate) return 'No estás en un combate. Usá #combate <enemigo> para iniciar.';
      const result = rpg.combatTurn(u, 'atacar');
      markEconDirty();
      let txt = `⚔️ *Combate*\n${result.resultado}`;
      if (result.terminado) {
        txt += `\n🏆 Combate terminado.`;
      }
      return txt;
    },
  },

  estado: {
    desc: ' Ver tu estado de aventurero completo.',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      rpg.ensureRPG(u);
      const clase = u.rpg.clase ? rpg.classLabel(u.rpg.clase) : 'Sin clase';
      const arma = rpg.weaponLabel(u.rpg.arma);
      const casa = u.rpg.casa ? rpg.getHouseBenefit(u.rpg.casa).nombre : 'Ninguna';
      const rank = rpg.getGuildRank(u.rpg.oro || 0);
      const gremio = u.rpg.gremio ? (settings.guilds && settings.guilds[u.rpg.gremio] ? settings.guilds[u.rpg.gremio].nombre : 'Desconocido') : 'Ninguno';
      return `👤 *Estado de Aventurero*\nClase: *${clase}*\nNivel: *${u.rpg.nivel}* (EXP: ${u.rpg.exp}/${u.rpg.nivel * 100})\nArma: *${arma}*\nCasa: *${casa}*\nGremio: *${gremio}*\nRango: *${rank.nombre}*\nOro RPG: ${money(u.rpg.oro || 0)}\n${u.rpg.nombrePersonalizado ? `Nombre: *${u.rpg.nombrePersonalizado}*\n` : ''}`;
    },
  },

  'dungeon-start': {
    desc: ' Tutorial de la mazmorra. Obtén equipamiento inicial para comenzar tu aventura.',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      rpg.ensureRPG(u);

      if (u.rpg.tutorialCompletado) {
        return 'Ya completaste el tutorial de la mazmorra. Usá #mazmorra para entrar.';
      }

      // Regalo inicial: espada de hierro + 2000 Coins
      const bonoOro = 2000;
      u.cash += bonoOro;
      if (!u.rpg.armas.includes('espada_hierro')) {
        u.rpg.armas.push('espada_hierro');
      }
      if (u.rpg.arma === 'nada') {
        u.rpg.arma = 'espada_hierro';
      }
      u.rpg.tutorialCompletado = true;
      markEconDirty();

      return ` 🏰 *Tutorial de la Mazmorra DKS*\n\n¡Bienvenido, aventurero! Aquí tienes lo necesario para empezar:\n\n💰 Recibiste *${money(bonoOro)}* de oro inicial.\n⚔️ Recibiste *${rpg.weaponLabel('espada_hierro')}* (ATK +8).\n\n📖 *Cómo jugar:*\n• Escribí #mazmorra <apuesta> para entrar a la mazmorra (mínimo 1000 Coins).\n• Usá #avanzar para subir de piso y obtener recompensas.\n• Usá #retirarse para salir con lo ganado.\n• Cuidado: si un monstruo te derrota, pierdes todo lo ganado en la sesión.\n\n💡 Consejo: Elige una clase con #clase antes de entrar para tener mejores stats en combate.\n\n¡Buena suerte en tu aventura! 🍀`;
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

  'reset-economy': {
    desc: ' 🔒 (solo el creador del bot) Reinicia TODO el dinero de todos los usuarios a 0.',
    execute: async (ctx) => {
      if (!isOwner(ctx)) return '🔒 Solo el creador del bot puede usar este comando.';
      let reseteados = 0;
      for (const [id, u] of Object.entries(econ.users)) {
        if (u.cash !== 0 || u.bank !== 0) {
          u.cash = 0;
          u.bank = 0;
          reseteados++;
        }
      }
      markEconDirty();
      writeAuditLog('reset-economy', getSenderId(ctx), 'todos', 0, ctx.jid);
      return `💸 Economía reiniciada para *${reseteados}* usuario(s). Todo el dinero se ha establecido a 0.`;
    },
  },

  tragamonedas: {
    desc: ' Tragamonedas del casino. Uso: #tragamonedas <apuesta> (mínimo 1000)',
    execute: async (ctx) => {
      const me = getSenderId(ctx);
      const u = econUser(me);
      const args = ctx.text.slice(config.prefix.length).trim().split(/\s+/).slice(1);
      const betArg = args[0];
      let bet;
      if (!betArg) return 'Uso: #tragamonedas <apuesta> (mínimo 1000 Coins). Ej: #tragamonedas 1000';
      if (betArg === 'all' || betArg === 'todo') bet = u.cash;
      else if (/^\d+$/.test(betArg)) bet = parseInt(betArg, 10);
      else return 'Uso: #tragamonedas <apuesta> (mínimo 1000 Coins). Ej: #tragamonedas 1000';
      if (!bet || bet < 1000) return 'La apuesta mínima es de *1000 Coins*.';
      if (bet > u.cash) return 'No tienes suficiente dinero para esa apuesta.';

      u.cash = Math.max(0, u.cash - bet);
      markEconDirty();

      const simbolos = ['🍒', '🍋', '🔔', '💎', '7️⃣'];
      const rodillo1 = simbolos[Math.floor(Math.random() * simbolos.length)];
      const rodillo2 = simbolos[Math.floor(Math.random() * simbolos.length)];
      const rodillo3 = simbolos[Math.floor(Math.random() * simbolos.length)];

      let multiplicador = 0;
      let mensajeResultado = '';

      if (rodillo1 === rodillo2 && rodillo2 === rodillo3) {
        // Jackpot: 3 iguales
        if (rodillo1 === '7️⃣') {
          multiplicador = 50; // Jackpot máximo
          mensajeResultado = `🎰 *JACKPOT MÁXIMO!* ¡${rodillo1} ${rodillo2} ${rodillo3}!`;
        } else {
          multiplicador = 10;
          mensajeResultado = `🎰 *¡JACKPOT!* ¡${rodillo1} ${rodillo2} ${rodillo3}!`;
        }
      } else if (rodillo1 === rodillo2 || rodillo2 === rodillo3 || rodillo1 === rodillo3) {
        // Dos iguales
        multiplicador = 2;
        mensajeResultado = `🎰 *¡Dos iguales!* ${rodillo1} ${rodillo2} ${rodillo3}`;
      } else {
        multiplicador = 0;
        mensajeResultado = `🎰 *Sigue intentando:* ${rodillo1} ${rodillo2} ${rodillo3}`;
      }

      const ganancia = Math.floor(bet * multiplicador);
      const neto = ganancia - bet;

      if (multiplicador > 0) {
        u.cash += ganancia;
        markEconDirty();
        writeAuditLog('tragamonedas', me, me, bet, ctx.jid);
      }

      return `🎰 *Tragamonedas DKS*\n\n${rodillo1} | ${rodillo2} | ${rodillo3}\n\n${mensajeResultado}\nApuesta: ${money(bet)}\n${multiplicador > 0 ? `¡Ganaste ${money(ganancia)}! (x${multiplicador})` : `Perdiste ${money(bet)}.`}\nSaldo actual: ${money(u.cash)}`;
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
    desc: ' 🔒 (solo el creador del bot) Crea dinero para alguien. Uso: #give @usuario <monto>',
    execute: async (ctx) => {
      if (!isOwner(ctx)) return '🔒 Solo el creador del bot puede usar este comando.';
      const target = getTargetUser(ctx);
      const args = ctx.text.slice(config.prefix.length).trim().split(/\s+/).slice(1);
      const amountArg = args.length ? args[args.length - 1] : '';
      if (!target || !/^\d+$/.test(amountArg)) {
        return 'Uso: #give @usuario <monto>';
      }
      let amount = parseInt(amountArg, 10);
      amount = Math.min(amount, 1e12);
      if (!amount || amount <= 0) {
        return 'Monto inválido.';
      }
      econUser(target).cash += amount;
      markEconDirty();
      writeAuditLog('give', getSenderId(ctx), target, amount, ctx.jid);
      return `✿ Le diste *${money(amount)}* a *${displayName(target)}*.`;
    },
  },

  take: {
    desc: ' 🔒 (solo usuarios autorizados) Quitá dinero a alguien. Uso: #take @usuario <monto>',
    execute: async (ctx) => {
      if (!hasPermission(ctx)) return '🔒 Solo los usuarios autorizados pueden usar este comando.';
      const target = getTargetUser(ctx);
      const args = ctx.text.slice(config.prefix.length).trim().split(/\s+/).slice(1);
      const amountArg = args.length ? args[args.length - 1] : '';
      if (!target || !/^\d+$/.test(amountArg)) {
        return 'Uso: #take @usuario <monto>';
      }
      let amount = parseInt(amountArg, 10);
      amount = Math.min(amount, 1e12);
      if (!amount || amount <= 0) {
        return 'Monto inválido.';
      }
      const t = econUser(target);
      const taken = Math.min(amount, t.cash);
      t.cash = Math.max(0, t.cash - taken);
      markEconDirty();
      writeAuditLog('take', getSenderId(ctx), target, taken, ctx.jid);
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

  restrict: {
    desc: ' 🔒 (solo dueño) Agrega/quita/lista comandos restringidos. Uso: #restrict add|del|list <comando>',
    execute: async (ctx) => {
      if (!isOwner(ctx)) return '🔒 Solo el creador del bot puede usar este comando.';
      settings.restrictedCommands = settings.restrictedCommands || [];
      const args = ctx.text.slice(config.prefix.length).trim().split(/\s+/).slice(1);
      const action = args[0] ? args[0].toLowerCase() : '';
      const cmd = args[1] ? args[1].toLowerCase() : '';

      if (action === 'list') {
        const list = settings.restrictedCommands.length
          ? settings.restrictedCommands.join(', ')
          : '*Ninguno*';
        return ` *Comandos restringidos:*\n\n${list}`;
      }

      if (!cmd) {
        return `Uso: ${config.prefix}restrict add <comando> | ${config.prefix}restrict del <comando> | ${config.prefix}restrict list`;
      }

      // Resolver alias
      const resolvedCmd = commandAliases[cmd] || cmd;
      if (!commands[resolvedCmd]) return 'Comando no existe.';

      // Los comandos hard-restrict no se pueden desbloquear
      if (action === 'del' && HARD_RESTRICTED.includes(resolvedCmd)) {
        return `⚠️ El comando ${resolvedCmd} no se puede desbloquear.`;
      }

      if (action === 'add') {
        if (settings.restrictedCommands.includes(resolvedCmd)) {
          return `⚠️ ${resolvedCmd} ya está restringido.`;
        }
        settings.restrictedCommands.push(resolvedCmd);
        saveSettings();
        return `✅ ${resolvedCmd} agregado a comandos restringidos.`;
      }

      if (action === 'del') {
        const idx = settings.restrictedCommands.indexOf(resolvedCmd);
        if (idx === -1) return `⚠️ ${resolvedCmd} no está restringido.`;
        settings.restrictedCommands.splice(idx, 1);
        saveSettings();
        return `🗑️ ${resolvedCmd} removido de comandos restringidos.`;
      }

      return `Uso: ${config.prefix}restrict add <comando> | ${config.prefix}restrict del <comando> | ${config.prefix}restrict list`;
    },
  },

  ecolog: {
    desc: ' 🔒 (solo autorizados) Muestra las últimas 10 líneas del log de auditoría de economía.',
    execute: async (ctx) => {
      if (!hasPermission(ctx)) return '🔒 Solo los usuarios autorizados pueden usar este comando.';
      const AUDIT_FILE = path.join(DKS_DATA_DIR, 'audit.log');
      if (!fs.existsSync(AUDIT_FILE)) return 'No hay registros de auditoría.';
      try {
        const lines = fs.readFileSync(AUDIT_FILE, 'utf8').trim().split('\n').filter(Boolean);
        const last10 = lines.slice(-10);
        if (last10.length === 0) return 'No hay registros de auditoría.';
        return ` *Auditoría de economía (últimas 10):*\n\n${last10.join('\n')}`;
      } catch (e) {
        return 'No se pudo leer el log de auditoría.';
      }
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
  const publicCommands = ['help', 'info', 'ping', 'medida', 'match', '8ball', 'ruleta', 'blackjack', 'pedir', 'plantarme', 'doblar', 'mazmorra', 'avanzar', 'retirarse', 'mazmorra-boss', 'pelear-boss', 'clase', 'armas', 'herrero', 'pescar', 'minar', 'gremio', 'rango', 'npc', 'nombre', 'casa', 'contratar', 'aprendiz', 'misiones', 'mision', 'combate', 'pelear', 'estado', 'dungeon-start', 'reset-economy', 'tragamonedas', 'cofre', 'bosses', 'skill', 'combinar', 'stats', 'evolucionar', 'habilidades', 'desbloquear', 'domar', 'bestias', 'especial', 'testlobby', 'work', 'slut', 'crime', 'bal', 'baltop', 'deposit', 'withdraw', 'daily', 'rob', 'pay'];

  if (!chatAdminCommands.includes(resolvedCommand) && !isChatAllowed(ctx)) return;

  if (OWNER_ONLY.includes(resolvedCommand) && !isOwner(ctx)) {
    console.log('[cmd] BLOQUEADO (solo dueño)', resolvedCommand, 'from', getSenderId(ctx));
    await reply(ctx, '🔒 Solo el creador del bot puede usar este comando.');
    return;
  }

  if (isRestricted(resolvedCommand) && !hasPermission(ctx)) {
    console.log('[cmd] BLOQUEADO (restringido)', resolvedCommand, 'from', getSenderId(ctx));
    await reply(ctx, '🔒 Este comando es solo para usuarios autorizados.');
    return;
  }

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

const shutdown = () => {
  flushEcon();
};

process.on('exit', shutdown);
process.on('SIGINT', () => { shutdown(); process.exit(0); });
process.on('SIGTERM', () => { shutdown(); process.exit(0); });
process.on('SIGHUP', () => { shutdown(); process.exit(0); });

process.on('uncaughtException', (err) => {
  console.error('✗ uncaughtException:', (err && err.stack) || err);
  shutdown();
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('✗ unhandledRejection:', (reason && reason.stack) || reason);
});

startBot().catch((e) => {
  console.error('Error iniciando el bot:', e);
  shutdown();
  process.exit(1);
});
