// Botín: cofres y eventos de mazmorra/portales.

const { CHESTS, OBJETOS_COMBATE } = require('../data/items');
const { EVENTOS_MAZMORRA } = require('../data/zones');
const { rand, money, pick } = require('./narrate');
const { addExp } = require('./progression');
const { ensureRPG } = require('./migrate');

const openChest = (u, chestKey) => {
  const chest = CHESTS[chestKey];
  if (!chest) return null;
  ensureRPG(u);
  if (u.cash < chest.costo) return { error: 'No tienes suficiente dinero para abrir este cofre.' };

  u.cash = Math.max(0, u.cash - chest.costo);
  const esTrampa = Math.random() * 100 < chest.trampa;

  if (esTrampa) {
    const perdida = Math.floor(u.cash * 0.5);
    u.cash = Math.max(0, u.cash - perdida);
    return {
      tipo: 'trampa',
      mensaje: `💀 ¡Trampa! El cofre explota y pierdes ${money(perdida)}.`,
      costo: chest.costo,
      perdida,
    };
  }

  const ganancia = rand(chest.min, chest.max);
  u.cash += ganancia;
  let mensaje = `🎉 ¡Cofre abierto! Encontraste ${money(ganancia)}.`;
  // FASE 5: a veces cae un objeto de combate (objProb del cofre).
  let objeto = null;
  if (Math.random() * 100 < (chest.objProb || 0)) {
    const id = pick(Object.keys(OBJETOS_COMBATE));
    objeto = OBJETOS_COMBATE[id];
    if (!u.rpg.inventario) u.rpg.inventario = {};
    u.rpg.inventario[id] = (u.rpg.inventario[id] || 0) + 1;
    mensaje += ` Y un objeto: *${objeto.nombre}* (usá #obj ${id}).`;
  }
  return {
    tipo: 'exito',
    mensaje,
    costo: chest.costo,
    ganancia,
    objeto: objeto ? objeto.id : null,
  };
};

// Evento aleatorio de piso. Recibe un objeto con cash (usuario o sesión de portal).
const generarEventoMazmorra = (u) => {
  const r = Math.random() * 100;
  let acumulado = 0;
  for (const [key, ev] of Object.entries(EVENTOS_MAZMORRA)) {
    acumulado += ev.prob;
    if (r <= acumulado) {
      if (ev.tipo === 'oro') {
        const ganancia = rand(ev.min, ev.max);
        u.cash += ganancia;
        return { tipo: 'oro', mensaje: `📦 ${ev.desc}\n💰 Encontraste ${money(ganancia)}.`, ganancia };
      }
      if (ev.tipo === 'perder_oro') {
        const perdida = Math.min(u.cash, rand(ev.min, ev.max));
        u.cash = Math.max(0, u.cash - perdida);
        return { tipo: 'perder_oro', mensaje: `🌑 ${ev.desc}\n💸 Perdiste ${money(perdida)}.`, perdida };
      }
      if (ev.tipo === 'curar') {
        return { tipo: 'curar', mensaje: `💧 ${ev.desc}\n❤️ Te sientes renovado (+${ev.valor} vitalidad).` };
      }
      if (ev.tipo === 'sacrificio') {
        const costo = Math.min(u.cash, rand(ev.min, ev.max));
        u.cash = Math.max(0, u.cash - costo);
        const bono = Math.floor(costo * 1.5);
        return { tipo: 'sacrificio', mensaje: `⚔️ ${ev.desc}\n💸 Sacrificaste ${money(costo)} para ganar fuerza.`, costo, bono };
      }
      if (ev.tipo === 'exp') {
        const expGanada = rand(ev.min, ev.max);
        const subida = addExp(u, expGanada);
        let mensaje = `✨ ${ev.desc}\n⭐ Ganaste ${expGanada} EXP.`;
        if (subida) mensaje += `\n${subida}`;
        return { tipo: 'exp', mensaje, exp: expGanada };
      }
    }
  }
  return { tipo: 'nada', mensaje: '🚶 Nada especial ocurrió en este piso.' };
};

module.exports = { openChest, generarEventoMazmorra };
