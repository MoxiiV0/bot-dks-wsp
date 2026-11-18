// FASE 5 — Estados alterados. DATA pura: duración, acumulación, daño por
// turno y textos. El motor (core/combat.js) los aplica sin números mágicos.
//
// Campos:
//   duracionTurnos  — duración por aplicación
//   maxPila         — cuántas veces se acumula (si apilaRenueva solo refresca)
//   dot             — daño por turno al iniciar el turno del afectado
//                     ({ tipo: 'pctHp', pct }) o ({ tipo: 'fijo', valor })
//   saltarTurno     — no puede actuar en su turno
//   rompeAlDanar    — se elimina al recibir daño (congelado)
//   bonusAtk        — multiplica el ATK del que lo tiene (furia)
//   danioExtraPct   — % extra de daño recibido (marca)
//   reduccionDanio  — % menos de daño recibido (escudo)
//   textos          — { aplicar, tick, fin }

const STATUSES = {
  sangrado: {
    id: 'sangrado', nombre: '🩸 Sangrado',
    duracionTurnos: 3, maxPila: 3,
    dot: { tipo: 'pctHp', pct: 0.03 },
    textos: {
      aplicar: '🩸 {nombre} sangra.',
      tick: '🩸 Sangrado: {dano} de daño.',
      fin: '🩸 El sangrado se detuvo.',
    },
  },
  quemadura: {
    id: 'quemadura', nombre: '🔥 Quemadura',
    duracionTurnos: 2, maxPila: 2,
    dot: { tipo: 'pctHp', pct: 0.04 },
    textos: {
      aplicar: '🔥 {nombre} arde en llamas.',
      tick: '🔥 Quemadura: {dano} de daño.',
      fin: '🔥 Las llamas se apagaron.',
    },
  },
  veneno: {
    id: 'veneno', nombre: '☠️ Veneno',
    duracionTurnos: 3, maxPila: 3,
    dot: { tipo: 'pctHp', pct: 0.035 },
    textos: {
      aplicar: '☠️ {nombre} está envenenado.',
      tick: '☠️ Veneno: {dano} de daño.',
      fin: '☠️ El veneno se disipó.',
    },
  },
  aturdido: {
    id: 'aturdido', nombre: '💫 Aturdido',
    duracionTurnos: 1, maxPila: 1,
    saltarTurno: true,
    textos: {
      aplicar: '💫 {nombre} queda aturdido y pierde su turno.',
      tick: '💫 {nombre} está aturdido.',
      fin: '💫 {nombre} recupera el control.',
    },
  },
  congelado: {
    id: 'congelado', nombre: '❄️ Congelado',
    duracionTurnos: 1, maxPila: 1,
    saltarTurno: true,
    rompeAlDanar: true,
    textos: {
      aplicar: '❄️ {nombre} queda congelado.',
      tick: '❄️ {nombre} está congelado.',
      fin: '❄️ {nombre} se descongela.',
    },
  },
  escudo: {
    id: 'escudo', nombre: '🛡️ Escudo',
    duracionTurnos: 2, maxPila: 1,
    reduccionDanio: 0.4,
    textos: {
      aplicar: '🛡️ Un escudo envuelve a {nombre} (−40% de daño).',
      tick: '🛡️ El escudo de {nombre} resiste.',
      fin: '🛡️ El escudo de {nombre} se disipa.',
    },
  },
  furia: {
    id: 'furia', nombre: '😡 Furia',
    duracionTurnos: 3, maxPila: 1,
    bonusAtk: 0.25,
    textos: {
      aplicar: '😡 {nombre} entra en furia (+25% ATK).',
      tick: '😡 {nombre} sigue en furia.',
      fin: '😡 {nombre} se calma.',
    },
  },
  marca: {
    id: 'marca', nombre: '🎯 Marca de Presa',
    duracionTurnos: 3, maxPila: 1,
    danioExtraPct: 0.2,
    textos: {
      aplicar: '🎯 {nombre} queda marcado (+20% de daño recibido).',
      tick: '🎯 {nombre} sigue marcado.',
      fin: '🎯 La marca sobre {nombre} desaparece.',
    },
  },
};

module.exports = { STATUSES };
