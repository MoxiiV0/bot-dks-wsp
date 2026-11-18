// FASE 8 — Arcos narrativos estilo anime.
// 4 arcos x 8 capítulos. Cada capítulo tiene:
//   - diálogo: 3 a 5 líneas { quien, linea }
//   - tipo: 'combate' | 'prueba'
//   - enemigo: clave de zona (getEnemy) o 'rival_kazuki' (inline, abajo)
//   - enemigoInline: objeto enemigo completo para rivales (se pasa a startCombat)
//   - prueba: { tipo: 'stat'|'azar', atributo?, umbral?, prob? }
//   - recompensa: { oro, exp, item?, itemCant? }
//   - proximoEpisodio: frase final "Próximo episodio: X"
//   - requisitos: { nivel? }
// Todo es DATA (cero números mágicos en la lógica).

const cap = (id, titulo, dialogo, tipo, opts = {}) => ({
  id,
  titulo,
  dialogo,
  tipo,
  enemigo: opts.enemigo || null,
  enemigoInline: opts.enemigoInline || null,
  zona: opts.zona || null,
  prueba: opts.prueba || null,
  recompensa: opts.recompensa || { oro: 100, exp: 50 },
  proximoEpisodio: opts.proximoEpisodio || '...',
  requisitos: opts.requisitos || { nivel: 1 },
});

// --- Rival recurrente (no está en zonas; se pasa como enemy a startCombat) ---
const RIVAL_KAZUKI_1 = {
  clave: 'rival_kazuki',
  nombre: '⚔️ Kazuki (tu rival)',
  hp: 300,
  atk: 14,
  def: 8,
  vel: 12,
  elemento: 'rayo',
  arquetipo: 'agresivo',
  oro: 800,
  exp: 200,
};
const RIVAL_KAZUKI_2 = {
  clave: 'rival_kazuki',
  nombre: '⚔️ Kazuki (tu rival)',
  hp: 700,
  atk: 22,
  def: 12,
  vel: 15,
  elemento: 'rayo',
  arquetipo: 'agresivo',
  oro: 1800,
  exp: 400,
};
const RIVAL_KAZUKI_3 = {
  clave: 'rival_kazuki',
  nombre: '⚔️ Kazuki (tu rival)',
  hp: 1500,
  atk: 36,
  def: 20,
  vel: 20,
  elemento: 'rayo',
  arquetipo: 'agresivo',
  oro: 3800,
  exp: 900,
};

const sakura = [
  // 1
  cap('sakura_1', 'El Despertar del Aldeano', [
    { quien: 'Abuela', linea: 'Hace años que el espíritu del puente no descansa.' },
    { quien: 'Tú', linea: '¿Qué debo hacer, abuela?' },
    { quien: 'Abuela', linea: 'Ve al Bosque de los Mil Torii y enfrenta al Jabalí Joven.' },
  ], 'combate', {
    enemigo: 'jabali_joven', zona: 'sakura',
    recompensa: { oro: 500, exp: 100 },
    proximoEpisodio: 'La Sombra en los Torii',
    requisitos: { nivel: 1 },
  }),
  // 2
  cap('sakura_2', 'La Sombra en los Torii', [
    { quien: 'Guardián', linea: 'Solo los que demuestren su valor cruzan el Torii.' },
    { quien: 'Tú', linea: 'Estoy listo para la prueba.' },
    { quien: 'Guardián', linea: 'Entonces enfrenta a la Serpiente de Bambú.' },
  ], 'combate', {
    enemigo: 'serpiente_bamboo', zona: 'sakura',
    recompensa: { oro: 600, exp: 130, item: 'pocion_hp', itemCant: 1 },
    proximoEpisodio: 'El Lobo de la Noche',
    requisitos: { nivel: 2 },
  }),
  // 3
  cap('sakura_3', 'El Lobo de la Noche', [
    { quien: 'Abuela', linea: 'Un lobo rabioso acecha el camino de la aldea.' },
    { quien: 'Tú', linea: 'Lo detendré antes de que haga daño.' },
    { quien: 'Abuela', linea: 'Cuida tu espalda, no lucha solo.' },
  ], 'combate', {
    enemigo: 'lobo_rabioso', zona: 'sakura',
    recompensa: { oro: 700, exp: 150 },
    proximoEpisodio: 'Encuentro con el Rival',
    requisitos: { nivel: 4 },
  }),
  // 4
  cap('sakura_4', 'Encuentro con el Rival', [
    { quien: 'Kazuki', linea: 'Así que eres tú el que habla la abuela. Déjame ver qué vales.' },
    { quien: 'Tú', linea: 'No me voy a esconder detrás de nadie.' },
    { quien: 'Kazuki', linea: 'Entonces demuéstrame con el acero, no con palabras.' },
  ], 'combate', {
    enemigo: 'rival_kazuki', zona: 'sakura', enemigoInline: RIVAL_KAZUKI_1,
    recompensa: { oro: 900, exp: 200, item: 'pocion_ki', itemCant: 1 },
    proximoEpisodio: 'El Espíritu del Santuario',
    requisitos: { nivel: 6 },
  }),
  // 5
  cap('sakura_5', 'El Espíritu del Santuario', [
    { quien: 'Monje', linea: 'Un espíritu inquieto ronda el santuario lunar.' },
    { quien: 'Tú', linea: 'Lo calmaré de una forma u otra.' },
    { quien: 'Monje', linea: 'Ten cuidado: no todos los espíritus perdonan.' },
  ], 'combate', {
    enemigo: 'rata_gigante', zona: 'sakura',
    recompensa: { oro: 400, exp: 90 },
    proximoEpisodio: 'El Oni del Puente',
    requisitos: { nivel: 7 },
  }),
  // 6
  cap('sakura_6', 'El Oni del Puente', [
    { quien: 'Abuela', linea: 'El Oni del Puente exige un tributo para dejar pasar.' },
    { quien: 'Tú', linea: 'No pagaré con miedo. Pagaré con acero.' },
    { quien: 'Abuela', linea: 'Es el jefe de esta zona. No subestimes su fuerza.' },
  ], 'combate', {
    enemigo: 'oni_puente', zona: 'sakura',
    recompensa: { oro: 1500, exp: 300, item: 'elixir', itemCant: 1 },
    proximoEpisodio: 'El Juramento de Kazuki',
    requisitos: { nivel: 8 },
  }),
  // 7
  cap('sakura_7', 'El Juramento de Kazuki', [
    { quien: 'Kazuki', linea: 'Has crecido, pero yo también. Esta es nuestra definición.' },
    { quien: 'Tú', linea: 'Solo uno de nosotros sigue adelante después de hoy.' },
    { quien: 'Kazuki', linea: 'Entonces que el más fuerte quede en pie.' },
  ], 'combate', {
    enemigo: 'rival_kazuki', zona: 'sakura', enemigoInline: RIVAL_KAZUKI_2,
    recompensa: { oro: 1200, exp: 250 },
    proximoEpisodio: 'Un Nuevo Rumbo',
    requisitos: { nivel: 9 },
  }),
  // 8
  cap('sakura_8', 'Un Nuevo Rumbo', [
    { quien: 'Abuela', linea: 'Has superado la prueba de la aldea. Ahora el mundo te espera.' },
    { quien: 'Tú', linea: '¿Adónde voy ahora?' },
    { quien: 'Abuela', linea: 'Hacia el Torneo de las Cuatro Lunas. Tu verdadero desafío comienza allá.' },
  ], 'prueba', {
    prueba: { tipo: 'stat', atributo: 'atk', umbral: 10 },
    recompensa: { oro: 800, exp: 200 },
    proximoEpisodio: 'Inscripción al Torneo',
    requisitos: { nivel: 10 },
  }),
];

const lunas = [
  // 1
  cap('lunas_1', 'Inscripción al Torneo', [
    { quien: 'Organizador', linea: 'Bienvenido al Torneo de las Cuatro Lunas.' },
    { quien: 'Tú', linea: 'Vengo a competir y a poner a prueba mi fuerza.' },
    { quien: 'Organizador', linea: 'Demuéstralo en la primera eliminatoria.' },
  ], 'prueba', {
    prueba: { tipo: 'stat', atributo: 'def', umbral: 8 },
    recompensa: { oro: 600, exp: 150 },
    proximoEpisodio: 'Primera Eliminatoria',
    requisitos: { nivel: 10 },
  }),
  // 2
  cap('lunas_2', 'Primera Eliminatoria', [
    { quien: 'Locutor', linea: 'Primera ronda: Espiritu del Torii contra el candidato.' },
    { quien: 'Tú', linea: 'No me rindo ni un paso atrás.' },
    { quien: 'Locutor', linea: '¡Comience el combate!' },
  ], 'combate', {
    enemigo: 'zorro_espectral', zona: 'torii',
    recompensa: { oro: 900, exp: 200 },
    proximoEpisodio: 'Duelo en la Luz de la Luna',
    requisitos: { nivel: 12 },
  }),
  // 3
  cap('lunas_3', 'Duelo en la Luz de la Luna', [
    { quien: 'Locutor', linea: 'Bajo la luna llena, un fantasma busca venganza.' },
    { quien: 'Tú', linea: 'No dejo que el pasado me detenga.' },
    { quien: 'Locutor', linea: 'El Espíritu Fantasma Lunar entra al ruedo.' },
  ], 'combate', {
    enemigo: 'fantasma_lunar', zona: 'luna',
    recompensa: { oro: 1100, exp: 250 },
    proximoEpisodio: 'El Guardián del Templo',
    requisitos: { nivel: 16 },
  }),
  // 4
  cap('lunas_4', 'El Guardián del Templo', [
    { quien: 'Sacerdote', linea: 'El templo está protegido por un guardián de piedra.' },
    { quien: 'Tú', linea: '¿Y debo derrotarlo para avanzar?' },
    { quien: 'Sacerdote', linea: 'Solo los dignos obtienen su bendición.' },
  ], 'combate', {
    enemigo: 'guardian_templo', zona: 'luna',
    recompensa: { oro: 1400, exp: 300, item: 'elixir', itemCant: 1 },
    proximoEpisodio: 'Eliminatoria contra un Rival',
    requisitos: { nivel: 20 },
  }),
  // 5
  cap('lunas_5', 'Eliminatoria contra un Rival', [
    { quien: 'Kazuki', linea: 'También estoy en el torneo. Nos veremos en la final.' },
    { quien: 'Tú', linea: 'Te espero en el último combate.' },
    { quien: 'Kazuki', linea: 'Hasta entonces, no pierdas antes de tiempo.' },
  ], 'combate', {
    enemigo: 'rival_kazuki', zona: 'luna', enemigoInline: RIVAL_KAZUKI_2,
    recompensa: { oro: 1800, exp: 400 },
    proximoEpisodio: 'La Momia del Santuario',
    requisitos: { nivel: 22 },
  }),
  // 6
  cap('lunas_6', 'La Momia del Santuario', [
    { quien: 'Guardián', linea: 'La momia lunar custodia un tesoro olvidado.' },
    { quien: 'Tú', linea: 'No permitiré que maldiga a la aldea.' },
    { quien: 'Guardián', linea: 'Enfréntala, pero no toques sus vendas.' },
  ], 'combate', {
    enemigo: 'momia_lunar', zona: 'luna',
    recompensa: { oro: 1300, exp: 350 },
    proximoEpisodio: 'Semifinal: Caballero de Huesos',
    requisitos: { nivel: 24 },
  }),
  // 7
  cap('lunas_7', 'Semifinal: Caballero de Huesos', [
    { quien: 'Locutor', linea: 'Semifinal: el Caballero de Huesos, élite del torneo.' },
    { quien: 'Tú', linea: 'He vencido a peores que un esqueleto.' },
    { quien: 'Locutor', linea: '¡Que comience la semifinal!' },
  ], 'combate', {
    enemigo: 'caballero_huesos', zona: 'luna',
    recompensa: { oro: 2200, exp: 500, item: 'pocion_hp', itemCant: 2 },
    proximoEpisodio: 'Final del Torneo',
    requisitos: { nivel: 26 },
  }),
  // 8
  cap('lunas_8', 'Final del Torneo', [
    { quien: 'Locutor', linea: 'El Guardián de la Luna, jefe del torneo, espera al finalista.' },
    { quien: 'Tú', linea: 'Esta es mi oportunidad.' },
    { quien: 'Locutor', linea: '¡Que comience la final!' },
  ], 'combate', {
    enemigo: 'guardian_lunar', zona: 'luna',
    recompensa: { oro: 3500, exp: 800, item: 'elixir', itemCant: 2 },
    proximoEpisodio: 'La Llamada del Trueno',
    requisitos: { nivel: 28 },
  }),
];

const trueno = [
  // 1
  cap('trueno_1', 'La Llamada del Trueno', [
    { quien: 'Maestro', linea: 'Las Cumbres del Trueno llaman a los guerreros más fuertes.' },
    { quien: 'Tú', linea: 'Respondo a ese llamado.' },
    { quien: 'Maestro', linea: 'Demuestra tu reflejo antes de ascender.' },
  ], 'prueba', {
    prueba: { tipo: 'stat', atributo: 'vel', umbral: 12 },
    recompensa: { oro: 1500, exp: 400 },
    proximoEpisodio: 'Dragón Menor',
    requisitos: { nivel: 30 },
  }),
  // 2
  cap('trueno_2', 'Dragón Menor', [
    { quien: 'Maestro', linea: 'Un dragón menor acecha las cumbres.' },
    { quien: 'Tú', linea: 'Su fuego no quemará mi determinación.' },
    { quien: 'Maestro', linea: 'Cuidado con su cola.' },
  ], 'combate', {
    enemigo: 'dragon_menor', zona: 'trueno',
    recompensa: { oro: 2500, exp: 600 },
    proximoEpisodio: 'Samurái Caído',
    requisitos: { nivel: 32 },
  }),
  // 3
  cap('trueno_3', 'Samurái Caído', [
    { quien: 'Espíritu', linea: 'Soy un samurái caído que aún busca una muerte digna.' },
    { quien: 'Tú', linea: 'Te daré el descanso que buscas.' },
    { quien: 'Espíritu', linea: 'Entonces lucha como un verdadero guerrero.' },
  ], 'combate', {
    enemigo: 'samurai_caido', zona: 'trueno',
    recompensa: { oro: 2800, exp: 650 },
    proximoEpisodio: 'Espíritu del Trueno',
    requisitos: { nivel: 35 },
  }),
  // 4
  cap('trueno_4', 'Espíritu del Trueno', [
    { quien: 'Chamán', linea: 'El Espíritu del Trueno castiga a los indignos con relámpagos.' },
    { quien: 'Tú', linea: 'No temo a la tormenta.' },
    { quien: 'Chamán', linea: 'Entonces enfréntala de frente.' },
  ], 'combate', {
    enemigo: 'espiritu_trueno', zona: 'trueno',
    recompensa: { oro: 3000, exp: 700 },
    proximoEpisodio: 'Rival en las Cumbres',
    requisitos: { nivel: 38 },
  }),
  // 5
  cap('trueno_5', 'Rival en las Cumbres', [
    { quien: 'Kazuki', linea: 'Las cumbres son mi terreno. No te atrevas a subir.' },
    { quien: 'Tú', linea: 'Voy a subir hasta donde tú estés.' },
    { quien: 'Kazuki', linea: 'Entonces que el trueno decida al ganador.' },
  ], 'combate', {
    enemigo: 'rival_kazuki', zona: 'trueno', enemigoInline: RIVAL_KAZUKI_3,
    recompensa: { oro: 3800, exp: 900 },
    proximoEpisodio: 'Ronin Vendado',
    requisitos: { nivel: 40 },
  }),
  // 6
  cap('trueno_6', 'Ronin Vendado', [
    { quien: 'Ronin', linea: 'Mi espada no tiene amo, pero sí tiene destino.' },
    { quien: 'Tú', linea: 'Tu destino termina aquí.' },
    { quien: 'Ronin', linea: 'Veremos eso.' },
  ], 'combate', {
    enemigo: 'ronin_vendado', zona: 'trueno',
    recompensa: { oro: 3200, exp: 750 },
    proximoEpisodio: 'Dragón de la Nube',
    requisitos: { nivel: 42 },
  }),
  // 7
  cap('trueno_7', 'Dragón de la Nube', [
    { quien: 'Maestro', linea: 'El Dragón de la Nube vuela sobre las cumbres más altas.' },
    { quien: 'Tú', linea: 'Lo traeré a tierra.' },
    { quien: 'Maestro', linea: 'Que el viento te acompañe.' },
  ], 'combate', {
    enemigo: 'dragon_nube', zona: 'trueno',
    recompensa: { oro: 4000, exp: 1000 },
    proximoEpisodio: 'El Dragón del Trueno',
    requisitos: { nivel: 45 },
  }),
  // 8
  cap('trueno_8', 'El Dragón del Trueno', [
    { quien: 'Maestro', linea: 'El jefe de las cumbres: el Dragón del Trueno.' },
    { quien: 'Tú', linea: 'Este es mi desafío más grande.' },
    { quien: 'Maestro', linea: 'Si lo vences, el Abismo será tu próximo paso.' },
  ], 'combate', {
    enemigo: 'dragon_trueno', zona: 'trueno',
    recompensa: { oro: 6000, exp: 1500, item: 'elixir', itemCant: 3 },
    proximoEpisodio: 'Umbral del Vacío',
    requisitos: { nivel: 48 },
  }),
];

const abismo = [
  // 1
  cap('abismo_1', 'Umbral del Vacío', [
    { quien: 'Guía', linea: 'El Abismo Eclipse no perdona a los débiles de espíritu.' },
    { quien: 'Tú', linea: 'Mi espíritu no es débil.' },
    { quien: 'Guía', linea: 'Demuéstralo resistiendo el vacío.' },
  ], 'prueba', {
    prueba: { tipo: 'stat', atributo: 'def', umbral: 20 },
    recompensa: { oro: 4000, exp: 1200 },
    proximoEpisodio: 'Demonio Menor',
    requisitos: { nivel: 50 },
  }),
  // 2
  cap('abismo_2', 'Demonio Menor', [
    { quien: 'Guía', linea: 'Un demonio menor acaba de cruzar el umbral.' },
    { quien: 'Tú', linea: 'Lo enviaré de vuelta al vacío.' },
    { quien: 'Guía', linea: 'Cuidado con sus garras.' },
  ], 'combate', {
    enemigo: 'demonio_menor', zona: 'abismo',
    recompensa: { oro: 5000, exp: 1500 },
    proximoEpisodio: 'Espectro del Vacío',
    requisitos: { nivel: 52 },
  }),
  // 3
  cap('abismo_3', 'Espectro del Vacío', [
    { quien: 'Guía', linea: 'Un espectro del vacío drena la vida de todo lo que toca.' },
    { quien: 'Tú', linea: 'No tocará nada mientras yo esté de pie.' },
    { quien: 'Guía', linea: 'Mantén tu Ki alto.' },
  ], 'combate', {
    enemigo: 'espectro_vacio', zona: 'abismo',
    recompensa: { oro: 5500, exp: 1700 },
    proximoEpisodio: 'Acechador del Abismo',
    requisitos: { nivel: 54 },
  }),
  // 4
  cap('abismo_4', 'Acechador del Abismo', [
    { quien: 'Guía', linea: 'El Acechador del Abismo acecha en las sombras más profundas.' },
    { quien: 'Tú', linea: 'No hay sombra donde no pueda llegar mi espada.' },
    { quien: 'Guía', linea: 'Entonces demuéstralo.' },
  ], 'combate', {
    enemigo: 'acechador_abismo', zona: 'abismo',
    recompensa: { oro: 6000, exp: 1900 },
    proximoEpisodio: 'Sentinela del Eclipse',
    requisitos: { nivel: 55 },
  }),
  // 5
  cap('abismo_5', 'Sentinela del Eclipse', [
    { quien: 'Guía', linea: 'La Sentinela del Eclipse observa el abismo desde hace siglos.' },
    { quien: 'Tú', linea: 'Hoy termina su vigilia.' },
    { quien: 'Guía', linea: 'Cuidado, su luz ciega.' },
  ], 'combate', {
    enemigo: 'sentinela_eclipse', zona: 'abismo',
    recompensa: { oro: 7000, exp: 2200 },
    proximoEpisodio: 'Campeón del Vacío',
    requisitos: { nivel: 56 },
  }),
  // 6
  cap('abismo_6', 'Campeón del Vacío', [
    { quien: 'Guía', linea: 'El Campeón del Vacío ha derrotado a docenas de aventureros.' },
    { quien: 'Tú', linea: 'Será el siguiente en caer.' },
    { quien: 'Guía', linea: 'No subestimes su técnica.' },
  ], 'combate', {
    enemigo: 'campeon_vacio', zona: 'abismo',
    recompensa: { oro: 8000, exp: 2500 },
    proximoEpisodio: 'General Demonio',
    requisitos: { nivel: 57 },
  }),
  // 7
  cap('abismo_7', 'General Demonio', [
    { quien: 'Guía', linea: 'El General Demonio lidera las fuerzas del abismo.' },
    { quien: 'Tú', linea: 'Su ejército termina aquí.' },
    { quien: 'Guía', linea: 'Es élite. Prepárate.' },
  ], 'combate', {
    enemigo: 'demonio_general', zona: 'abismo',
    recompensa: { oro: 10000, exp: 3000, item: 'pocion_hp', itemCant: 3 },
    proximoEpisodio: 'Señor del Vacío',
    requisitos: { nivel: 58 },
  }),
  // 8
  cap('abismo_8', 'Señor del Vacío', [
    { quien: 'Guía', linea: 'El Señor del Vacío gobierna el Abismo Eclipse.' },
    { quien: 'Tú', linea: 'Este es el combate final.' },
    { quien: 'Guía', linea: 'Si lo vences, serás una leyenda.' },
  ], 'combate', {
    enemigo: 'senor_vacio', zona: 'abismo',
    recompensa: { oro: 15000, exp: 5000 },
    proximoEpisodio: 'El fin de este viaje... por ahora',
    requisitos: { nivel: 60 },
  }),
];

const ARCS = {
  sakura: {
    id: 'sakura',
    nombre: 'Arco de la Aldea Sakura Rota',
    descripcion: 'Tutorial y primer encuentro con el rival.',
    capitulos: sakura,
  },
  lunas: {
    id: 'lunas',
    nombre: 'Arco del Torneo de las Cuatro Lunas',
    descripcion: 'Eliminatorias PvE contra rivales y combate final.',
    capitulos: lunas,
  },
  trueno: {
    id: 'trueno',
    nombre: 'Arco de las Cumbres del Trueno',
    descripcion: 'Desafíos entre dragones, samuráis y tormentas.',
    capitulos: trueno,
  },
  abismo: {
    id: 'abismo',
    nombre: 'Arco del Abismo Eclipse',
    descripcion: 'El vacío y los demonios que lo habitan.',
    capitulos: abismo,
  },
};

module.exports = { ARCS };
