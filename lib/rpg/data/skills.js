// Datos de habilidades: kits por clase, combinaciones y desbloqueos por nivel.
//
// FASE 4: SKILLS_V2 es el kit nuevo con el esquema obligatorio del prompt:
//   { id, nombre, clase, nivelReq, costoKi, cooldown, objetivo,
//     efectos: [ {tipo:'dano', mult, elemento} | {tipo:'estado', id, prob, turnos} ],
//     frase, banner (solo ougi) }
// El motor que la consume (costoKi, efectos, estados, elementos) llega en la
// FASE 5 (#hab). SKILLS/COMBINACIONES/HABILIDADES_POR_NIVEL son el sistema
// LEGADO que sigue operativo con #skill hasta esa fase, re-claveados a las
// clases nuevas (FASE 4).

// ---------------------------------------------------------------------------
// FASE 4 — kits nuevos (DATA pura; los números se afinan con tools/simulate.js)
// ---------------------------------------------------------------------------
const SKILLS_V2 = {
  // ⚔️ Kensei
  corte_relampago: {
    id: 'corte_relampago', nombre: '⚡ Corte Relámpago', clase: 'espadachin', nivelReq: 1,
    costoKi: 10, cooldown: 2, objetivo: 'enemigo',
    efectos: [{ tipo: 'dano', mult: 1.6, elemento: 'rayo' }],
    frase: '¡La hoja truena antes que el rayo!',
  },
  postura_montana: {
    id: 'postura_montana', nombre: '⛰️ Postura de la Montaña', clase: 'espadachin', nivelReq: 5,
    costoKi: 14, cooldown: 4, objetivo: 'self',
    efectos: [{ tipo: 'estado', id: 'escudo', prob: 1, turnos: 2 }],
    frase: 'Ni el viento me mueve.',
  },
  tajo_carmesi: {
    id: 'tajo_carmesi', nombre: '🩸 Tajo Carmesí', clase: 'espadachin', nivelReq: 10,
    costoKi: 20, cooldown: 4, objetivo: 'enemigo',
    efectos: [
      { tipo: 'dano', mult: 1.9, elemento: null },
      { tipo: 'estado', id: 'sangrado', prob: 0.7, turnos: 3 },
    ],
    frase: '¡Sangre sobre la arena!',
  },
  ougi_amanecer_rojo: {
    id: 'ougi_amanecer_rojo', nombre: '🌅 Ougi: Amanecer Rojo', clase: 'espadachin', nivelReq: 25,
    costoKi: 45, cooldown: 8, objetivo: 'enemigo',
    efectos: [{ tipo: 'dano', mult: 3.2, elemento: 'fuego' }],
    frase: '¡El cielo se tiñe de carmesí!',
    banner: '🌅 *OUGI — AMANECER ROJO* 🌅\nLa hoja rasga el horizonte y el día comienza con sangre.',
  },
  // 🔮 Onmyōji
  sello_llama: {
    id: 'sello_llama', nombre: '🔥 Sello de Llama', clase: 'mago', nivelReq: 1,
    costoKi: 12, cooldown: 2, objetivo: 'enemigo',
    efectos: [
      { tipo: 'dano', mult: 1.7, elemento: 'fuego' },
      { tipo: 'estado', id: 'quemadura', prob: 0.5, turnos: 2 },
    ],
    frase: '¡El sello arde en silencio!',
  },
  barrera_talismanes: {
    id: 'barrera_talismanes', nombre: '🛡️ Barrera de Talismanes', clase: 'mago', nivelReq: 5,
    costoKi: 16, cooldown: 4, objetivo: 'self',
    efectos: [{ tipo: 'estado', id: 'escudo', prob: 1, turnos: 2 }],
    frase: '¡Los papeles cantan su guardia!',
  },
  tormenta_papel: {
    id: 'tormenta_papel', nombre: '🌪️ Tormenta de Papel', clase: 'mago', nivelReq: 10,
    costoKi: 24, cooldown: 4, objetivo: 'todos',
    efectos: [{ tipo: 'dano', mult: 1.5, elemento: 'viento' }],
    frase: '¡Mil papeles, mil cortes!',
  },
  ougi_ocaso_eterno: {
    id: 'ougi_ocaso_eterno', nombre: '🌘 Ougi: Ocaso Eterno', clase: 'mago', nivelReq: 25,
    costoKi: 55, cooldown: 8, objetivo: 'enemigo',
    efectos: [
      { tipo: 'dano', mult: 3.5, elemento: 'agua' },
      { tipo: 'estado', id: 'congelado', prob: 0.3, turnos: 1 },
    ],
    frase: '¡El sol no vuelve a salir!',
    banner: '🌘 *OUGI — OCASO ETERNO* 🌘\nLos cuatro sellos se alinean y la luz se rinde.',
  },
  // 🏹 Cazador Hayate
  flecha_fugaz: {
    id: 'flecha_fugaz', nombre: '💨 Flecha Fugaz', clase: 'arquero', nivelReq: 1,
    costoKi: 10, cooldown: 2, objetivo: 'enemigo',
    efectos: [{ tipo: 'dano', mult: 1.6, elemento: 'viento' }],
    frase: '¡Ni la sombra la ve venir!',
  },
  marca_presa: {
    id: 'marca_presa', nombre: '🎯 Marca de Presa', clase: 'arquero', nivelReq: 5,
    costoKi: 14, cooldown: 4, objetivo: 'enemigo',
    efectos: [{ tipo: 'estado', id: 'marca', prob: 1, turnos: 3 }],
    frase: '¡Elegido. Marcado. Muerto!',
  },
  lluvia_estelar: {
    id: 'lluvia_estelar', nombre: '🌠 Lluvia Estelar', clase: 'arquero', nivelReq: 10,
    costoKi: 24, cooldown: 4, objetivo: 'enemigo',
    efectos: [{ tipo: 'dano', mult: 2.4, elemento: 'luz' }],
    frase: '¡Que caigan las estrellas!',
  },
  ougi_meteoro_cazador: {
    id: 'ougi_meteoro_cazador', nombre: '☄️ Ougi: Meteoro Cazador', clase: 'arquero', nivelReq: 25,
    costoKi: 50, cooldown: 8, objetivo: 'enemigo',
    efectos: [{ tipo: 'dano', mult: 3.4, elemento: 'fuego' }],
    frase: '¡El cielo apunta contigo!',
    banner: '☄️ *OUGI — METEORO CAZADOR* ☄️\nUna sola flecha enciende el cielo nocturno.',
  },
  // 🌑 Shinobi
  paso_sombra: {
    id: 'paso_sombra', nombre: '👣 Paso Sombra', clase: 'ladron', nivelReq: 1,
    costoKi: 10, cooldown: 2, objetivo: 'enemigo',
    efectos: [
      { tipo: 'dano', mult: 1.5, elemento: 'sombra' },
      { tipo: 'estado', id: 'escudo', prob: 0.4, turnos: 1 },
    ],
    frase: '¡Dónde había sombra, hay acero!',
  },
  kunai_envenenado: {
    id: 'kunai_envenenado', nombre: '☠️ Kunai Envenenado', clase: 'ladron', nivelReq: 5,
    costoKi: 16, cooldown: 3, objetivo: 'enemigo',
    efectos: [
      { tipo: 'dano', mult: 1.4, elemento: null },
      { tipo: 'estado', id: 'veneno', prob: 0.8, turnos: 3 },
    ],
    frase: '¡Un solo rasguño basta!',
  },
  danza_sombras: {
    id: 'danza_sombras', nombre: '🌑 Danza de Cien Sombras', clase: 'ladron', nivelReq: 10,
    costoKi: 26, cooldown: 4, objetivo: 'enemigo',
    efectos: [{ tipo: 'dano', mult: 2.6, elemento: 'sombra' }],
    frase: '¡Cien sombras, cien cortes!',
  },
  ougi_luna_rota: {
    id: 'ougi_luna_rota', nombre: '🌑 Ougi: Luna Rota', clase: 'ladron', nivelReq: 25,
    costoKi: 48, cooldown: 8, objetivo: 'enemigo',
    efectos: [
      { tipo: 'dano', mult: 3.3, elemento: 'sombra' },
      { tipo: 'estado', id: 'aturdido', prob: 0.4, turnos: 1 },
    ],
    frase: '¡La luna cierra los ojos!',
    banner: '🌑 *OUGI — LUNA ROTA* 🌑\nEl reflejo se quiebra; cuando vuelve a unirse, todo terminó.',
  },
  // 🦊 Shikigami
  sello_espiritual: {
    id: 'sello_espiritual', nombre: '⭐ Sello Espiritual', clase: 'invocador', nivelReq: 1,
    costoKi: 10, cooldown: 2, objetivo: 'enemigo',
    efectos: [{ tipo: 'dano', mult: 1.5, elemento: 'luz' }],
    frase: '¡El pacto se cumple!',
  },
  resguardo_ancestral: {
    id: 'resguardo_ancestral', nombre: '🛡️ Resguardo Ancestral', clase: 'invocador', nivelReq: 5,
    costoKi: 15, cooldown: 4, objetivo: 'self',
    efectos: [{ tipo: 'estado', id: 'escudo', prob: 1, turnos: 2 }],
    frase: '¡Los antiguos velan por mí!',
  },
  turba_espiritual: {
    id: 'turba_espiritual', nombre: '👻 Turba Espiritual', clase: 'invocador', nivelReq: 10,
    costoKi: 24, cooldown: 4, objetivo: 'todos',
    efectos: [{ tipo: 'dano', mult: 1.6, elemento: 'sombra' }],
    frase: '¡La manada responde a mi llamada!',
  },
  ougi_mil_espiritus: {
    id: 'ougi_mil_espiritus', nombre: '🎆 Ougi: Festival de los Mil Espíritus', clase: 'invocador', nivelReq: 25,
    costoKi: 52, cooldown: 8, objetivo: 'todos',
    efectos: [{ tipo: 'dano', mult: 2.8, elemento: 'luz' }],
    frase: '¡Mil faroles, mil aliados!',
    banner: '🎆 *OUGI — FESTIVAL DE LOS MIL ESPÍRITUS* 🎆\nEl cielo se llena de luces que luchan a tu lado.',
  },
  // 👻 Médium Yūrei
  susurro_funebre: {
    id: 'susurro_funebre', nombre: '☠️ Susurro Fúnebre', clase: 'invocador', nivelReq: 1,
    costoKi: 10, cooldown: 2, objetivo: 'enemigo',
    efectos: [{ tipo: 'dano', mult: 1.6, elemento: 'sombra' }],
    frase: '¡Los muertos me susurran tu nombre!',
  },
  velo_cenizas: {
    id: 'velo_cenizas', nombre: '🕯️ Velo de Cenizas', clase: 'invocador', nivelReq: 5,
    costoKi: 15, cooldown: 4, objetivo: 'enemigo',
    efectos: [{ tipo: 'estado', id: 'quemadura', prob: 0.6, turnos: 2 }],
    frase: '¡Todo se apaga en ceniza!',
  },
  cadena_animas: {
    id: 'cadena_animas', nombre: '⛓️ Cadena de Ánimas', clase: 'invocador', nivelReq: 10,
    costoKi: 25, cooldown: 4, objetivo: 'enemigo',
    efectos: [
      { tipo: 'dano', mult: 2.2, elemento: 'sombra' },
      { tipo: 'estado', id: 'aturdido', prob: 0.35, turnos: 1 },
    ],
    frase: '¡Volved a vuestra jaula!',
  },
  ougi_procesion: {
    id: 'ougi_procesion', nombre: '🥀 Ougi: Procesión del Silencio', clase: 'invocador', nivelReq: 25,
    costoKi: 55, cooldown: 8, objetivo: 'enemigo',
    efectos: [
      { tipo: 'dano', mult: 3.3, elemento: 'sombra' },
      { tipo: 'estado', id: 'sangrado', prob: 0.5, turnos: 3 },
    ],
    frase: '¡Nadie escucha llegar el final!',
    banner: '🥀 *OUGI — PROCESIÓN DEL SILENCIO* 🥀\nLa comitiva pasa en silencio; a su paso, ya no queda vida.',
  },
};

// Lista ordenada por clase (para #hab de la FASE 5 y para tools)
const KITS_POR_CLASE = Object.values(SKILLS_V2).reduce((acc, s) => {
  (acc[s.clase] = acc[s.clase] || []).push(s);
  return acc;
}, {});

// FASE 5 — alias: nombres legados de #skill -> kit FASE 5 (mismo orden táctico:
// 1er skill de daño, 2do defensivo de la clase).
const SKILLS_ALIAS = {
  golpe_fuerte: 'corte_relampago',
  escudo: 'postura_montana',
  bola_fuego: 'sello_llama',
  curacion: 'barrera_talismanes',
  disparo_preciso: 'flecha_fugaz',
  evasion: 'marca_presa',
  ataque_sombra: 'paso_sombra',
  sigilo: 'kunai_envenenado',
  domar_bestia: 'sello_espiritual',
  invocacion: 'turba_espiritual',
  animar_muerto: 'susurro_funebre',
  explosion_ossea: 'cadena_animas',
};

// ---------------------------------------------------------------------------
// LEGADO — sistema actual de #skill/#combinar (operativo hasta la FASE 5),
// re-claveado a las clases FASE 4.
// ---------------------------------------------------------------------------
const SKILLS = {
  kensei: {
    golpe_fuerte: { nombre: '💥 Golpe Fuerte', descripcion: 'Ataque potente que causa 1.5x daño.', costo: 10, multiplicador: 1.5 },
    escudo: { nombre: '🛡️ Escudo', descripcion: 'Reduce daño entrante un 50% este turno.', costo: 15, reduccion: 0.5 },
  },
  onmyoji: {
    bola_fuego: { nombre: '🔥 Bola de Fuego', descripcion: 'Causa 2x daño mágico.', costo: 20, multiplicador: 2 },
    curacion: { nombre: '✨ Curación', descripcion: 'Recupera 30 de vida en combate.', costo: 15, curacion: 30 },
  },
  hayate: {
    disparo_preciso: { nombre: '🎯 Disparo Preciso', descripcion: 'Golpe crítico garantizado (2x daño).', costo: 12, multiplicador: 2 },
    evasion: { nombre: '🌀 Evasión', descripcion: '50% de probabilidad de esquivar el próximo ataque.', costo: 18, evadir: 0.5 },
  },
  shinobi: {
    ataque_sombra: { nombre: '🌑 Ataque en Sombra', descripcion: 'Causa 1.8x daño y roba oro.', costo: 18, multiplicador: 1.8, roba_oro: true },
    sigilo: { nombre: '🫥 Sigilo', descripcion: 'El siguiente turno no recibes daño.', costo: 25, bloquear: true },
  },
  shikigami: {
    domar_bestia: { nombre: '🐺 Domar Bestia', descripcion: 'Invoca a tu bestia domada para atacar.', costo: 15, multiplicador: 1.4 },
    invocacion: { nombre: '👹 Invocación', descripcion: 'Espíritu aliado golpea con 1.8x daño.', costo: 25, multiplicador: 1.8 },
  },
  medium_yurei: {
    animar_muerto: { nombre: '💀 Animar Muerto', descripcion: 'Almas errantes causan 1.6x daño.', costo: 15, multiplicador: 1.6 },
    explosion_ossea: { nombre: '🦴 Explosión Ósea', descripcion: 'Estalla con 2x daño.', costo: 28, multiplicador: 2 },
  },
};

const COMBINACIONES_SKILLS = {
  'golpe_fuerte+escudo': { nombre: '💥🛡️ Golpe Escudo', descripcion: 'Ataque potente con reducción de daño.', clases: ['kensei'], skill1: 'golpe_fuerte', skill2: 'escudo', resultado: 'golpe_escudo', costo: 20 },
  'bola_fuego+curacion': { nombre: '🔥✨ Fuego Sanador', descripcion: 'Ataca y te curas al mismo tiempo.', clases: ['onmyoji'], skill1: 'bola_fuego', skill2: 'curacion', resultado: 'fuego_sanador', costo: 25 },
  'disparo_preciso+evasion': { nombre: '🎯🌀 Tiro Evasivo', descripcion: 'Disparo crítico con posibilidad de esquivar.', clases: ['hayate'], skill1: 'disparo_preciso', skill2: 'evasion', resultado: 'tiro_evasivo', costo: 22 },
  'ataque_sombra+sigilo': { nombre: '🌑🫥 Sombra Sigilosa', descripcion: 'Ataque desde las sombras sin ser detectado.', clases: ['shinobi'], skill1: 'ataque_sombra', skill2: 'sigilo', resultado: 'sombra_sigilosa', costo: 30 },
};

const HABILIDADES_POR_NIVEL = {
  kensei: [
    { nivel: 5, key: 'golpe_fuerte', nombre: '💥 Golpe Fuerte', costo: 10 },
    { nivel: 10, key: 'escudo', nombre: '🛡️ Escudo', costo: 15 },
    { nivel: 15, key: 'embestida', nombre: '🐂 Embestida', costo: 20 },
    { nivel: 20, key: 'furia', nombre: '😡 Furia Berserker', costo: 25 },
  ],
  onmyoji: [
    { nivel: 5, key: 'bola_fuego', nombre: '🔥 Bola de Fuego', costo: 20 },
    { nivel: 10, key: 'curacion', nombre: '✨ Curación', costo: 15 },
    { nivel: 15, key: 'rayo', nombre: '⚡ Rayo', costo: 25 },
    { nivel: 20, key: 'meteorito', nombre: '☄️ Meteorito', costo: 40 },
  ],
  hayate: [
    { nivel: 5, key: 'disparo_preciso', nombre: '🎯 Disparo Preciso', costo: 12 },
    { nivel: 10, key: 'evasion', nombre: '🌀 Evasión', costo: 18 },
    { nivel: 15, key: 'disparo_rapido', nombre: '⚡ Disparo Rápido', costo: 22 },
    { nivel: 20, key: 'lluvia_flechas', nombre: '🌧️ Lluvia de Flechas', costo: 35 },
  ],
  shinobi: [
    { nivel: 5, key: 'ataque_sombra', nombre: '🌑 Ataque en Sombra', costo: 18 },
    { nivel: 10, key: 'sigilo', nombre: '🫥 Sigilo', costo: 25 },
    { nivel: 15, key: 'dagas_venenosas', nombre: '☠️ Dagas Venenosas', costo: 28 },
    { nivel: 20, key: 'golpe_mortal', nombre: '💀 Golpe Mortal', costo: 45 },
  ],
  shikigami: [
    { nivel: 5, key: 'domar_bestia', nombre: '🐺 Domar Bestia', costo: 15 },
    { nivel: 10, key: 'invocacion', nombre: '👹 Invocación', costo: 25 },
    { nivel: 15, key: 'bestia_alpha', nombre: '🐉 Bestia Alpha', costo: 40 },
  ],
  medium_yurei: [
    { nivel: 5, key: 'animar_muerto', nombre: '💀 Animar Muerto', costo: 15 },
    { nivel: 10, key: 'explosion_ossea', nombre: '🦴 Explosión Ósea', costo: 28 },
    { nivel: 15, key: 'ejercito_sombras', nombre: '👥 Ejército de Sombras', costo: 45 },
  ],
};

const HABILIDADES_ESPECIALES = {
  10: { key: 'golpe_epico', nombre: '⭐ Golpe Épico', descripcion: 'Daño masivo 3x. Solo cada 10 niveles.', costo: 50 },
  20: { key: 'habilidad_ultima', nombre: '🌟 Habilidad Última', descripcion: 'Tu poder máximo desbloqueado.', costo: 100 },
  30: { key: 'dios_de_la_guerra', nombre: '⚡ Dios de la Guerra', descripcion: 'Inmortalidad temporal por 3 turnos.', costo: 200 },
  40: { key: 'final_eclipse', nombre: '🌑 Eclipse Final', descripcion: 'Aniquila a todos los enemigos.', costo: 500 },
};

module.exports = {
  SKILLS_V2,
  KITS_POR_CLASE,
  SKILLS_ALIAS,
  SKILLS,
  COMBINACIONES_SKILLS,
  HABILIDADES_POR_NIVEL,
  HABILIDADES_ESPECIALES,
};
