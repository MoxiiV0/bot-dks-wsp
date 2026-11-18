// FASE 14 — Narrativa y formato de mensajes.
// Plantillas y variantes aleatorias para que los mensajes no se repitan.
// Todo es DATA pura; sin globales sueltos.

const FRASES = {
  victoria: [
    '{nombre} ha sido derrotado.',
    '¡{nombre} cae en combate!',
    'Victoria contra {nombre}.',
  ],
  derrota: [
    'Has sido derrotado por {nombre}.',
    '{nombre} te ha vencido.',
    'Caes ante {nombre}.',
  ],
  golpe: [
    '¡{ataque}! Infliges {dano} de daño.{critico}',
    'Con {ataque} causas {dano} de daño.{critico}',
    '¡{ataque}! {dano} de daño.{critico}',
  ],
  telegrafia: [
    '{nombre} alza su arma... ⚠️ Defiéndete con #def',
    '{nombre} se prepara para golpear... ⚠️ Usá #def',
    '{nombre} carga su ataque... ⚠️ #def para reducir daño',
  ],
  despertar: [
    '🌟 ¡Medidor de Despertar lleno! Activá tu poder con #despertar.',
    '🌟 ¡Despertar disponible! Usá #despertar para desatar tu poder.',
  ],
  subirNivel: [
    '⭐ *¡Subiste al nivel {nivel}! {textoPuntos}*',
    '🌟 ¡Nivel {nivel} alcanzado! {textoPuntos}',
  ],
  episodio: [
    'Próximo episodio: {titulo}',
    'En el próximo capítulo: {titulo}',
  ],
};

const frase = (tipo, vars = {}) => {
  const lista = FRASES[tipo] || FRASES.golpe;
  const plantilla = lista[Math.floor(Math.random() * lista.length)];
  return plantilla.replace(/\{(\w+)\}/g, (_, clave) => vars[clave] !== undefined ? vars[clave] : `{${clave}}`);
};

const barra = (actual, max, largo = 10) => {
  if (!max || max <= 0) return '▱'.repeat(largo);
  const llenos = Math.floor((actual / max) * largo);
  const vacíos = largo - llenos;
  return '█'.repeat(llenos) + '▱'.repeat(vacíos);
};

const formatoCombateTurno = (numero, nombreEnemigo, hpEnemigo, hpMaxEnemigo, hpJugador, hpMaxJugador, ki, kiMax, mensaje, zona) => {
  const bEnemigo = barra(hpEnemigo, hpMaxEnemigo);
  const bJugador = barra(hpJugador, hpMaxJugador);
  const bKi = barra(ki, kiMax);
  const pctEnemigo = hpMaxEnemigo > 0 ? Math.floor((hpEnemigo / hpMaxEnemigo) * 100) : 0;
  const pctJugador = hpMaxJugador > 0 ? Math.floor((hpJugador / hpMaxJugador) * 100) : 0;
  return [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `⚔️ *TURNO ${numero}* · ${zona}`,
    `👤 ${nombreEnemigo} ❤️ ${bEnemigo} ${hpEnemigo}/${hpMaxEnemigo} (${pctEnemigo}%)`,
    `👹 Tú ❤️ ${bJugador} ${hpJugador}/${hpMaxJugador} (${pctJugador}%) | 🌀 ${bKi} ${ki}/${kiMax}`,
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    mensaje,
    '',
  ].join('\n');
};

module.exports = { frase, barra, formatoCombateTurno, FRASES };
