// Inicialización y migración del esquema u.rpg.
//
// FASE 2: esquema v2 (v: 2) + migración v1 -> v2.
// - Idempotente: correr N veces no cambia nada (guarda por r.v).
// - Perezosa: se ejecuta dentro de ensureRPG la primera vez que el jugador
//   usa un comando RPG.
// - dry-run: migrate(u, {dryRun: true}) reporta cambios sin tocar el estado.
// - Log: cada migración con datos previos queda en logs/rpg-migraciones.log.
//
// v2 es ADITIVO: los campos v1 que todavía escriben comandos legacy siguen
// existiendo; core/ sincroniza proyecciones (v2 -> v1) en cada ensureRPG.

const fs = require('fs');
const path = require('path');
const { CLASS_MAP } = require('../data/migrations');
const { expToNext } = require('./curve');

const SCHEMA_VERSION = 2;

// ---------------------------------------------------------------------------
// Esquema v1 (legado) — se mantiene mientras los comandos viejos lo escriban.
// Ojo: mana/manaMax ya NO se crean; la migración los convierte a ki y los borra.
// ---------------------------------------------------------------------------
const ensureV1 = (u) => {
  if (!u.rpg) u.rpg = {};
  const r = u.rpg;
  if (!r.clase) r.clase = null;
  if (!r.arma) r.arma = null; // sin arma equipada por defecto (FASE 9: equipo es objeto item)
  if (!r.armas) r.armas = []; // sin armas legacy por defecto
  if (!r.nivel) r.nivel = 1;
  if (!r.exp) r.exp = 0;
  if (!r.oro) r.oro = 0;
  if (!r.pescado) r.pescado = 0;
  if (!r.minerales) r.minerales = 0;
  if (!r.nombrePersonalizado) r.nombrePersonalizado = null;
  if (!r.casa) r.casa = null;
  if (!r.aventureros) r.aventureros = [];
  if (!r.aprendiz) r.aprendiz = null;
  if (!r.misiones) r.misiones = {};
  if (!r.misionesCompletadas) r.misionesCompletadas = [];
  if (!r.combate) r.combate = null;
  if (!r.entrenamiento) r.entrenamiento = { atk: 0, def: 0, hp: 0 };
  if (!r.statsTrabajos) r.statsTrabajos = 0;
  if (!r.statsCrimenes) r.statsCrimenes = 0;
  if (!r.maxBank) r.maxBank = 0;
  if (!r.statsEnemigosDerrotados) r.statsEnemigosDerrotados = 0;
  if (!r.statsPisos) r.statsPisos = 0;
  if (!r.titulosDesbloqueados) r.titulosDesbloqueados = [];
  if (!r.tituloEquipado) r.tituloEquipado = null;
  if (r.tutorialCompletado === undefined) r.tutorialCompletado = false;
  if (!r.cd) r.cd = {};
  if (!r.v) r.v = 1;
  return r;
};

// ---------------------------------------------------------------------------
// Migración v1 -> v2
// ---------------------------------------------------------------------------
const huboDatosLegacy = (r) =>
  (r.nivel || 1) > 1 ||
  (r.exp || 0) > 0 ||
  typeof r.mana === 'number' ||
  (r.entrenamiento && (r.entrenamiento.atk || r.entrenamiento.def || r.entrenamiento.hp)) ||
  (r.statsEnemigosDerrotados || 0) > 0 ||
  (r.statsPisos || 0) > 0 ||
  (r.statsTrabajos || 0) > 0 ||
  (r.statsCrimenes || 0) > 0 ||
  (r.titulosDesbloqueados || []).length > 0;

const migrarAV2 = (u, opts = {}) => {
  const r = u.rpg;
  if ((r.v || 1) >= SCHEMA_VERSION) return { migrado: false, razon: 'ya-v2' };

  const cambios = [];
  const legacy = huboDatosLegacy(r);

  // Primero: corta re-entrancias (ensureRPG -> migrar -> getStats -> ensureRPG)
  r.v = SCHEMA_VERSION;

  // --- Stats anidados (fuente de verdad a partir de ahora) ---
  // IMPORTANTE: crearlos ANTES de cualquier require perezoso (getStats llama
  // a ensureRPG y su sincronización crearía stats en ceros, perdiendo los
  // contadores planos).
  if (!r.stats) {
    r.stats = {
      kills: r.statsEnemigosDerrotados || 0,
      pisos: r.statsPisos || 0,
      muertes: 0,
      duelos: 0,
    };
    if (r.stats.kills || r.stats.pisos) {
      cambios.push(`stats planos -> stats ${JSON.stringify(r.stats)}`);
    }
  }

  // --- Títulos: r.titulos es proyección del array legacy (misma referencia) ---
  if (!r.titulosDesbloqueados) r.titulosDesbloqueados = [];
  r.titulos = r.titulosDesbloqueados;

  // --- Identidad de clase / evolución ---
  // FASE 4 reestructurará clase/evolucion; hoy evolucion registra qué evolución
  // se tomó y clase sigue siendo la clase efectiva.
  if (r.claseEvolucionada && !r.evolucion) r.evolucion = r.clase;
  if (r.evolucion === undefined) r.evolucion = null;

  // --- HP / Ki ---
  // "mana pasa a ki": el recurso pasa a ki; la barra arranca llena.
  const kiMax = r.manaMax || 100;
  r.kiMax = kiMax;
  r.ki = kiMax;
  if (typeof r.mana === 'number') {
    cambios.push(`mana ${r.mana}/${r.manaMax || 100} -> ki ${r.ki}/${r.kiMax} (barra llena)`);
    delete r.mana;
    delete r.manaMax;
  }
  // HP: lo completa getStats con el máximo real de la build (clase+casa+título).
  // Se exige acá para que la migración lo deje "lleno"; si es clase sin clase
  // queda 0 y se rellena al elegir clase (regla hp<=0 -> lleno en getStats).
  if (r.hp === undefined || r.hp === null) {
    const { hpMaxDe } = require('./stats'); // require perezoso: evita ciclo con stats.js
    r.hp = hpMaxDe(u);
    cambios.push(`hp lleno: ${r.hp}`);
  }

  // --- Atributos ---
  r.despertar = r.despertar === undefined ? 0 : r.despertar;
  r.puntos = r.puntos === undefined ? 0 : r.puntos;
  if (!r.atributos) {
    const e = r.entrenamiento || { atk: 0, def: 0, hp: 0 };
    r.atributos = { atk: e.atk || 0, def: e.def || 0, hp: e.hp || 0, ki: 0, vel: 0 };
    if (e.atk || e.def || e.hp) {
      cambios.push(`entrenamiento ${JSON.stringify(e)} -> atributos ${JSON.stringify(r.atributos)}`);
    }
  }

  // --- Equipo / inventario ---
  if (!r.equipo) r.equipo = { arma: r.arma || 'nada', armadura: null, accesorio: null, reliquia: null };
  if (!r.inventario) r.inventario = {};

  // --- Habilidades {id: nivel} (desde el array legacy) ---
  if (!r.habilidades) r.habilidades = {};
  for (const k of r.habilidadesDesbloqueadas || []) {
    if (!(k in r.habilidades)) r.habilidades[k] = 1;
  }

  // --- Cooldowns: r.cooldowns comparte objeto con r.cd (helper rpgLeft legacy) ---
  if (!r.cd) r.cd = {};
  if (!r.cooldowns) r.cooldowns = r.cd;
  else if (r.cooldowns !== r.cd) {
    Object.assign(r.cd, r.cooldowns);
    r.cooldowns = r.cd;
  }

  // --- Estados / portal / social ---
  if (!r.estados) r.estados = [];
  if (r.portal === undefined) r.portal = null;
  if (!r['compañeros']) r['compañeros'] = [];
  if (!r.vinculos) r.vinculos = {};
  if (!r.rival) r.rival = { nivel: 0, victorias: 0, derrotas: 0 };
  if (!r.arco) r.arco = { id: null, capitulo: 0 };
  if (!r.rango) r.rango = 'E';

  // --- Regeneración / derrota ---
  if (!r.ultimaRegen) r.ultimaRegen = Date.now();
  if (!r.inconscienteHasta) r.inconscienteHasta = 0;

  // --- EXP a la nueva curva, SIN bajar de nivel ---
  const nivel = r.nivel || 1;
  const viejaMax = nivel * 100;
  const nuevaMax = expToNext(nivel);
  const pct = Math.max(0, Math.min(1, (r.exp || 0) / viejaMax));
  const expNueva = Math.min(nuevaMax - 1, Math.floor(pct * nuevaMax));
  if ((r.exp || 0) !== expNueva) {
    cambios.push(`exp ${r.exp || 0}/${viejaMax} -> ${expNueva}/${nuevaMax} (curva nueva, nv ${nivel})`);
  }
  r.exp = expNueva;

  if (legacy && !opts.silent) {
    logMigracion({
      cambios,
      antes: { v: 1, nivel, clase: r.clase },
      despues: { v: SCHEMA_VERSION, nivel, clase: r.clase, exp: `${expNueva}/${nuevaMax}` },
    });
  }

  return { migrado: true, cambios, legacy };
};

// Log de migraciones (archivo; nunca debe romper un comando).
const logMigracion = (entrada) => {
  try {
    const dir = path.join(__dirname, '..', '..', '..', 'logs');
    fs.mkdirSync(dir, { recursive: true });
    const linea = JSON.stringify({ ts: new Date().toISOString(), ...entrada }) + '\n';
    fs.appendFileSync(path.join(dir, 'rpg-migraciones.log'), linea);
  } catch (e) {
    console.log('[rpg:migracion]', JSON.stringify(entrada));
  }
};

// ---------------------------------------------------------------------------
// Proyecciones en cada ensureRPG: mantienen sincronizados v2 <-> v1.
// Regla: r.stats y los campos nuevos son fuente de verdad; los planos v1 son
// espejo para los comandos legacy que todavía los leen.
// ---------------------------------------------------------------------------
const sincronizarProyecciones = (r) => {
  if (!r.stats) r.stats = { kills: 0, pisos: 0, muertes: 0, duelos: 0 };
  r.statsEnemigosDerrotados = r.stats.kills || 0;
  r.statsPisos = r.stats.pisos || 0;

  // FASE 3: pago único retroactivo de puntos de atributo (2 por nivel ganado
  // antes de existir el sistema). Se hace una sola vez vía puntosOtorgados.
  if (!r.puntosOtorgados) {
    const { ENTRENAMIENTO } = require('../data/items'); // require perezoso: evita ciclo
    const retro = Math.max(0, (r.nivel || 1) - 1) * ENTRENAMIENTO.puntosPorNivel;
    r.puntos = (r.puntos || 0) + retro;
    r.puntosOtorgados = true;
  }

  // Títulos: unir por si algún lado agregó algo por separado
  if (!r.titulosDesbloqueados) r.titulosDesbloqueados = [];
  if (r.titulos !== r.titulosDesbloqueados) {
    for (const t of r.titulos || []) {
      if (!r.titulosDesbloqueados.includes(t)) r.titulosDesbloqueados.push(t);
    }
    r.titulos = r.titulosDesbloqueados;
  }

  // Cooldowns: misma referencia con el helper legacy rpgLeft (r.cd)
  if (!r.cd) r.cd = {};
  if (r.cooldowns !== r.cd) {
    Object.assign(r.cd, r.cooldowns || {});
    r.cooldowns = r.cd;
  }

  // Equipo: inicializar r.equipo si no existe (sin tocar r.equipo.arma;
  // la migración de string legacy a item FASE 9 la hace equipoDe perezosamente).
  if (!r.equipo) r.equipo = { arma: null, armadura: null, accesorio: null, reliquia: null };

  // Habilidades {id: nivel} <- array legacy
  if (!r.habilidades) r.habilidades = {};
  for (const k of r.habilidadesDesbloqueadas || []) {
    if (!(k in r.habilidades)) r.habilidades[k] = 1;
  }

  // Ki: si nunca se inicializó o se pasó del máximo
  if (r.kiMax == null) r.kiMax = 100;
  if (r.ki == null) r.ki = r.kiMax;
  if (r.ki > r.kiMax) r.ki = r.kiMax;

  // Evolución registrada
  if (r.claseEvolucionada && !r.evolucion) r.evolucion = r.clase;

  // Mapeo perezoso FASE 4: renombrar clase solo si el destino ya existe en data/
  // (hoy no existe -> no-op; se activa solo cuando FASE 4 agregue las clases).
  const destino = CLASS_MAP[r.clase];
  if (destino) {
    const { getClass } = require('../data/classes'); // require perezoso: evita ciclo
    if (getClass(destino)) r.clase = destino;
  }
};

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
// Inicializa + migra + sincroniza. Idempotente. Es el único punto de entrada.
const ensureRPG = (u) => {
  const r = ensureV1(u);
  if ((r.v || 1) < SCHEMA_VERSION) migrarAV2(u);
  sincronizarProyecciones(r);
  return r;
};

// Migración explícita con reporte. dryRun no toca el estado.
const migrate = (u, opts = {}) => {
  if (!u || !u.rpg) return { migrado: false, razon: 'sin-rpg', dryRun: !!opts.dryRun };
  if ((u.rpg.v || 1) >= SCHEMA_VERSION) {
    return { migrado: false, razon: 'ya-v2', version: u.rpg.v, dryRun: !!opts.dryRun };
  }
  if (!opts.dryRun) return migrarAV2(u);

  // dry-run: trabajamos sobre una copia y diffamos las claves
  // (clon doble: si `antes` y `despues` fueran el mismo objeto, el diff saldría vacío)
  const antes = JSON.parse(JSON.stringify(u.rpg));
  const copia = { ...u, rpg: JSON.parse(JSON.stringify(u.rpg)) };
  const res = migrarAV2(copia, { silent: true });
  const despues = copia.rpg;
  const anadidas = Object.keys(despues).filter((k) => !(k in antes));
  const modificadas = Object.keys(despues).filter(
    (k) => k in antes && JSON.stringify(antes[k]) !== JSON.stringify(despues[k])
  );
  return { ...res, dryRun: true, anadidas, modificadas };
};

module.exports = { SCHEMA_VERSION, ensureRPG, migrate, logMigracion, migrarAV2 };
