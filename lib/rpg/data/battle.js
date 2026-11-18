// FASE 5 — constantes del motor de combate unificado. Puro DATA.
// Todo lo que antes era "número mágico" en core/combat.js vive acá.

const BATALLA = {
  // Fórmula: bruto = ATK * mult * varianza(0.9..1.1); final = bruto * 100 / (100 + DEF)
  varianza: { min: 0.9, max: 1.1 },
  divisorDef: 100,
  golpeMinimo: 1,

  // Crítico: probabilidad base + bonos, multiplicador fijo.
  critico: { probBase: 0.05, mult: 1.5 },

  // Esquiva: tope duro del 40% (bonos de clase/estados suman hasta el tope).
  esquiva: { tope: 0.4 },

  // #def: reduce 50% el daño recibido y devuelve Ki.
  defensa: { reduccion: 0.5, kiDevuelto: 8 },

  // Telegrafía de jefes: un turno avisa; con #def recibís 70% menos.
  telegrafia: { reduccionConDefensa: 0.7, multAtaque: 3, textoCarga: 'carga un ataque enorme' },

  // Elementos: ventaja x1.25, desventaja x0.8 (ver ELEMENTOS abajo).
  elementos: { ventaja: 1.25, desventaja: 0.8 },

  // Medidor de Despertar (0-100) y modo Despertar.
  despertar: {
    max: 100,
    alGolpear: 5,
    alCritico: 15,
    alRecibirGolpe: 8,
    umbralGolpeFuerte: 0.12, // % del HP máx para que un golpe recibido cuente como fuerte
    turnosModo: 3,
    bonusAtk: 0.3,
    bonusVel: 0.3,
    turnosCansancio: 1,
  },

  // Derrota: pierde % del oro en mano, queda inconsciente y reaparece con 30% HP.
  derrota: { pierdePct: 0.1, inconscienteMs: 2 * 60 * 1000, hpRestantePct: 0.3 },

  // Límite de turnos: escapás; contra un jefe, además perdés % del oro en mano.
  // FASE 6: subido de 15 a 25 — los jefes de zona (HP x6) piden 12-20 turnos
  // según los objetivos de balance del prompt (FASE 15).
  limite: { turnos: 25, jefePierdePct: 0.2 },

  // Huida: probabilidad base + bonus por VEL (contra la VEL enemiga).
  huida: { probBase: 0.5, bonusPorVel: 0.04, tope: 0.9, piso: 0.15 },

  // Expiración por inactividad (timestamps, sin setTimeout).
  expiracionMs: 10 * 60 * 1000,

  // Enemigos sin VEL/arquetipo explícitos usan estos defaults.
  velEnemigoDefecto: 6,
  arquetipoDefecto: 'agresivo',

  // Botín ocasional de objetos de combate al vencer (%).
  dropObjetosProb: 15,
  dropObjetos: ['pocion_hp', 'pocion_ki'],

  // Doma de bestias (Shikigami).
  domaProb: 0.2,
};

// Elementos del combate (FASE 5). `ventaja` = elementos a los que gana este
// (x1.25); `desventaja` = elementos contra los que pierde (x0.8). Ciclo:
// fuego > viento > rayo > agua > fuego; la luz vence a la sombra.
const ELEMENTOS = {
  fuego: { nombre: '🔥 Fuego', ventaja: ['viento'], desventaja: ['agua'] },
  viento: { nombre: '🌪️ Viento', ventaja: ['rayo'], desventaja: ['fuego'] },
  rayo: { nombre: '⚡ Rayo', ventaja: ['agua'], desventaja: ['viento'] },
  agua: { nombre: '💧 Agua', ventaja: ['fuego'], desventaja: ['rayo'] },
  luz: { nombre: '✨ Luz', ventaja: ['sombra'], desventaja: [] },
  sombra: { nombre: '🌑 Sombra', ventaja: [], desventaja: ['luz'] },
};

// IA enemiga por arquetipo. Los jefes tienen fases al 70%, 40% y 15% de HP
// con cambio de patrón (más daño y más telegrafías).
const ARQUETIPOS = {
  agresivo: { nombre: 'Agresivo', multAtaque: 1.15, probDefender: 0.05, probCargar: 0.1 },
  defensivo: { nombre: 'Defensivo', multAtaque: 0.9, probDefender: 0.3, probCargar: 0.05 },
  erratico: { nombre: 'Errático', multAtaque: 1.0, probDefender: 0.15, probCargar: 0.2 },
  jefe: {
    nombre: 'Jefe',
    multAtaque: 1.1,
    probDefender: 0.1,
    probCargar: 0.2,
    fases: [
      { pct: 0.7, bonusAtk: 0.1, probCargar: 0.3 },
      { pct: 0.4, bonusAtk: 0.2, probCargar: 0.4 },
      { pct: 0.15, bonusAtk: 0.35, probCargar: 0.5 },
    ],
  },
};

module.exports = { BATALLA, ELEMENTOS, ARQUETIPOS };
