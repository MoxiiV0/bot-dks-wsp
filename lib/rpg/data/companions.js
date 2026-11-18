// FASE 10 — Compañeros y vínculos. Todo es DATA pura.
// Compañeros reclutables en los arcos (uno activo en combate, IA, rol propio).
// Los Shikigami usan el mismo sistema con espíritus.
// #domar y #invocar quedan como alias de #espiritu.

// Compañeros generales (reclutables al completar capítulos de arco).
// `rol`: tanque (recibe daño en lugar del jugador), curandero (cura al jugador),
// daño (ataca junto al jugador). `arcoDesbloqueo` = clave del arco necesario.
const COMPANIONES = {
  zorro: {
    nombre: '🦊 Zorro de las Sombras',
    rol: 'daño',
    costo: 3000,
    requisitoNivel: 10,
    arcoDesbloqueo: 'sakura',
    statsBase: { hp: 80, atk: 14, def: 4, vel: 12 },
    banner: '¡El Zorro de las Sombras se abalanza junto a ti!',
  },
  lince: {
    nombre: '🐯 Lince de la Luna',
    rol: 'tanque',
    costo: 4500,
    requisitoNivel: 20,
    arcoDesbloqueo: 'lunas',
    statsBase: { hp: 150, atk: 9, def: 10, vel: 8 },
    banner: '¡El Lince de la Luna te cubre con su pelaje!',
  },
  grulla: {
    nombre: '🐤 Grulla del Amanecer',
    rol: 'curandero',
    costo: 4000,
    requisitoNivel: 25,
    arcoDesbloqueo: 'lunas',
    statsBase: { hp: 60, atk: 6, def: 3, vel: 10 },
    banner: '¡La Grulla del Amanecer te cura con su canto!',
  },
  oni: {
    nombre: '👹 Oni Domado',
    rol: 'daño',
    costo: 7000,
    requisitoNivel: 35,
    arcoDesbloqueo: 'trueno',
    statsBase: { hp: 130, atk: 22, def: 8, vel: 10 },
    banner: '¡El Oni Domado aplasta a tu enemigo!',
  },
  fenix: {
    nombre: '🔥 Fénix del Vacío',
    rol: 'curandero',
    costo: 10000,
    requisitoNivel: 45,
    arcoDesbloqueo: 'abismo',
    statsBase: { hp: 100, atk: 8, def: 5, vel: 14 },
    banner: '¡El Fénix del Vacío renueva tu vitalidad!',
  },
};

// Espíritus del Shikigami (mismo sistema que compañeros, clave por espíritu).
const ESPIRITUS = {
  kodama: {
    nombre: '🌳 Kodama del Bosque',
    rol: 'curandero',
    costo: 2500,
    requisitoNivel: 10,
    arcoDesbloqueo: 'sakura',
    statsBase: { hp: 70, atk: 5, def: 3, vel: 11 },
    banner: '¡El Kodama del Bosque sana tus heridas!',
  },
  tengu: {
    nombre: '👺 Tengu del Viento',
    rol: 'daño',
    costo: 3500,
    requisitoNivel: 15,
    arcoDesbloqueo: 'sakura',
    statsBase: { hp: 60, atk: 18, def: 2, vel: 16 },
    banner: '¡El Tengu del Viento te acompaña en el ataque!',
  },
  komainu: {
    nombre: '🐕 Komainu Guardián',
    rol: 'tanque',
    costo: 5000,
    requisitoNivel: 20,
    arcoDesbloqueo: 'lunas',
    statsBase: { hp: 160, atk: 8, def: 12, vel: 7 },
    banner: '¡El Komainu Guardián te protege!',
  },
};

// Reglas de vínculo (DATA).
const VINCULO = {
  max: 5,
  puntosPorNivel: 10, // puntos de vínculo necesarios para subir cada nivel
  puntosPorCombate: 2, // puntos que se otorgan al ganar un combate con compañero activo
  ataqueCombinadoCadaTurnos: 4, // cada N turnos de combate activo
  ataqueCombinadoMinVinculo: 2, // vínculo mínimo para ataque combinado
};

// Daño del ataque combinado según rol (multiplicador sobre atk del compañero).
const DAÑO_COMBINADO_POR_ROL = {
  daño: 1.0,
  tanque: 0.5,
  curandero: 0.3,
};

// Cura del rol curandero por combate (puntos de HP).
const CURA_COMBINADA = 20;

module.exports = { COMPANIONES, ESPIRITUS, VINCULO, DAÑO_COMBINADO_POR_ROL, CURA_COMBINADA };
