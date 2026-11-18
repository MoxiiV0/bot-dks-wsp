// Datos de clases: bases, subclases (nivel 15), clases avanzadas (nivel 35)
// y pasivas. Todo es DATA pura — cero números mágicos en la lógica.
// FASE B: cinco clases base disponibles desde el nivel 1. Cada una tiene dos
// ramas: subclase en nivel 15 y clase avanzada en nivel 35.
// IDs con prefijo para no chocar con claves antiguas de la Fase 4.

// ---------------------------------------------------------------------------
// 1. CLASES BASE (disponibles desde el nivel 1)
// ---------------------------------------------------------------------------

// Ki/VEL por defecto para quien no tiene clase todavía (data, no número mágico)
const KI_SIN_CLASE = 100;
const VEL_SIN_CLASE = 5;
const CLASSES = {
  // ⚔️ Espadachín — Bruiser / tanque
  espadachin: {
    nombre: '⚔️ Espadachín', rol: 'Bruiser / tanque',
    hpBase: 130, kiBase: 60, atkBase: 16, defBase: 10, velBase: 8,
    crec: { hp: 14, ki: 3, atk: 2.2, def: 1.6 },
    pasiva: {
      clave: 'voluntad_acero', nombre: 'Voluntad de Acero',
      desc: 'Bajo 30% de HP, +25% DEF.',
      descMayor: 'Bajo 40% de HP, +35% DEF y +10% ATK.',
      efecto: { umbralHp: 0.3, defPct: 0.25 },
      efectoMayor: { umbralHp: 0.4, defPct: 0.35, atkPct: 0.1 },
    },
    desc: 'Resistente y fuerte en cuerpo a cuerpo. Aguanta lo que otros no.',
  },
  // 🗡️ Ladrón — Esquiva y combos
  ladron: {
    nombre: '🗡️ Ladrón', rol: 'Esquiva y combos',
    hpBase: 92, kiBase: 90, atkBase: 18, defBase: 5, velBase: 18,
    crec: { hp: 9, ki: 5, atk: 2.5, def: 0.9 },
    pasiva: {
      clave: 'paso_fantasma', nombre: 'Paso Fantasma',
      desc: '+10% de esquiva; tras esquivar, el siguiente golpe hace +30%.',
      descMayor: '+18% de esquiva y +50% al golpe tras esquivar.',
      efecto: { esquiva: 0.1, golpePostEsquiva: 0.3 },
      efectoMayor: { esquiva: 0.18, golpePostEsquiva: 0.5 },
    },
    desc: 'Esquiva, sigilo y combos rápidos.',
  },
  // 🦊 Invocador — Control con espíritus (Shikigami y Médium unificados)
  invocador: {
    nombre: '🦊 Invocador', rol: 'Control con espíritus',
    hpBase: 95, kiBase: 100, atkBase: 14, defBase: 6, velBase: 11,
    crec: { hp: 9, ki: 6, atk: 1.8, def: 0.9 },
    pasiva: {
      clave: 'pacto', nombre: 'Pacto',
      desc: 'El espíritu activo hereda el 60% de tus stats.',
      descMayor: 'El espíritu activo hereda el 80% de tus stats.',
      efecto: { heredaPct: 0.6 },
      efectoMayor: { heredaPct: 0.8 },
    },
    desc: 'Controla espíritus que luchan a tu lado.',
  },
  // 🔮 Mago — Daño explosivo elemental
  mago: {
    nombre: '🔮 Mago', rol: 'Daño explosivo elemental',
    hpBase: 85, kiBase: 120, atkBase: 22, defBase: 4, velBase: 9,
    crec: { hp: 8, ki: 7, atk: 3.0, def: 0.7 },
    pasiva: {
      clave: 'sellos_elementales', nombre: 'Sellos Elementales',
      desc: 'Encadenar fuego, viento, rayo y agua en orden da +20% de daño.',
      descMayor: 'Encadenar los cuatro elementos en orden da +35% de daño.',
      efecto: { secuencia: ['fuego', 'viento', 'rayo', 'agua'], bonusPct: 0.2 },
      efectoMayor: { secuencia: ['fuego', 'viento', 'rayo', 'agua'], bonusPct: 0.35 },
    },
    desc: 'Daño mágico elemental devastador con poca defensa.',
  },
  // 🏹 Arquero — Crítico a distancia
  arquero: {
    nombre: '🏹 Arquero', rol: 'Crítico a distancia',
    hpBase: 100, kiBase: 80, atkBase: 17, defBase: 6, velBase: 14,
    crec: { hp: 10, ki: 4, atk: 2.4, def: 1.0 },
    pasiva: {
      clave: 'ojo_halcon', nombre: 'Ojo de Halcón',
      desc: '+12% de probabilidad de crítico y +0.3 al multiplicador crítico.',
      descMayor: '+20% de probabilidad de crítico y +0.5 al multiplicador.',
      efecto: { critProb: 0.12, critMult: 0.3 },
      efectoMayor: { critProb: 0.2, critMult: 0.5 },
    },
    desc: 'Críticos a distancia y ojo implacable.',
  },
};

// ---------------------------------------------------------------------------
// 2. SUBCLASES (nivel 15) — dos ramas por clase base
// Cada rama tiene stats propias (HP/ATK/DEF) y hereda crecimiento/ki/VEL/pasiva
// de la clase base.
// ---------------------------------------------------------------------------
const SUBCLASES = {
  // Espadachín -> Samurái / Rōnin
  samurai: {
    clave: 'samurai', nombre: '🏯 Samurái', claseBase: 'espadachin', rama: 'honor',
    requisito: 15, costo: 0,
    hpBase: 165, atkBase: 21, defBase: 15, desc: 'Tanque con contraataques demoledores.',
    pasiva: {
      clave: 'honor_guerrero', nombre: 'Honor del Guerrero',
      desc: '+20% DEF y +10% ATK cuando no hay estados negativos.',
      descMayor: '+30% DEF y +20% ATK cuando no hay estados negativos.',
      efecto: { defPct: 0.20, atkPct: 0.10 },
      efectoMayor: { defPct: 0.30, atkPct: 0.20 },
    },
    habilidadFirma: { clave: 'iaido_relampago', nombre: '⚡ Iaido Relámpago', costoKi: 12, mult: 1.8, elemento: 'rayo' },
    desc: 'Tanque con contraataques demoledores.',
  },
  robin: {
    clave: 'robin', nombre: '🍃 Rōnin', claseBase: 'espadachin', rama: 'duelo',
    requisito: 15, costo: 0,
    hpBase: 140, atkBase: 26, defBase: 11, desc: 'Duelista de críticos letales.',
    pasiva: {
      clave: 'paso_vagabundo', nombre: 'Paso del Vagabundo',
      desc: '+12% esquiva; tras esquivar, el siguiente golpe hace +40%.',
      descMayor: '+20% esquiva y +60% al golpe tras esquivar.',
      efecto: { esquiva: 0.12, golpePostEsquiva: 0.40 },
      efectoMayor: { esquiva: 0.20, golpePostEsquiva: 0.60 },
    },
    habilidadFirma: { clave: 'corte_alba_eterna', nombre: '🌅 Corte del Alba Eterna', costoKi: 20, mult: 2.2, elemento: 'luz' },
    desc: 'Duelista de críticos letales.',
  },
  // Ladrón -> Ninja / Bandido
  ninja: {
    clave: 'ninja', nombre: '🥷 Ninja', claseBase: 'ladron', rama: 'sigilo',
    requisito: 15, costo: 0,
    hpBase: 100, atkBase: 22, defBase: 6, desc: 'Asesino de golpes definitivos.',
    pasiva: {
      clave: 'silencio_letal', nombre: 'Silencio Letal',
      desc: '+15% de daño contra enemigos con más del 70% de HP.',
      descMayor: '+25% de daño contra enemigos con más del 50% de HP.',
      efecto: { dmgPctVidaAlta: 0.15 },
      efectoMayor: { dmgPctVidaAlta: 0.25 },
    },
    habilidadFirma: { clave: 'clon_humo', nombre: '💨 Clon de Humo', costoKi: 12, mult: 1.5, elemento: 'sombra', estado: 'esquiva', turnos: 1 },
    desc: 'Asesino de golpes definitivos.',
  },
  bandido: {
    clave: 'bandido', nombre: '💰 Bandido', claseBase: 'ladron', rama: 'botin',
    requisito: 15, costo: 0,
    hpBase: 110, atkBase: 20, defBase: 8, desc: 'Oro, debuffs y críticos.',
    pasiva: {
      clave: 'suerte_ladrona', nombre: 'Suerte Ladrona',
      desc: '+10% de probabilidad de crítico y roba oro al atacar.',
      descMayor: '+18% de probabilidad de crítico y roba más oro al atacar.',
      efecto: { critProb: 0.10 },
      efectoMayor: { critProb: 0.18 },
    },
    habilidadFirma: { clave: 'robo_descarado', nombre: '🤑 Robo Descarado', costoKi: 18, mult: 1.7, elemento: null, robaOro: 0.1 },
    desc: 'Oro, debuffs y críticos.',
  },
  // Invocador -> Shikigami / Médium Yūrei
  shikigami: {
    clave: 'shikigami', nombre: '🦊 Shikigami', claseBase: 'invocador', rama: 'celestial',
    requisito: 15, costo: 0,
    hpBase: 100, atkBase: 16, defBase: 7, desc: 'Espíritus aliados y apoyo.',
    pasiva: {
      clave: 'pacto_celestial', nombre: 'Pacto Celestial',
      desc: 'El espíritu activo hereda el 70% de tus stats.',
      descMayor: 'El espíritu activo hereda el 90% de tus stats.',
      efecto: { heredaPct: 0.7 },
      efectoMayor: { heredaPct: 0.9 },
    },
    habilidadFirma: { clave: 'invocar_zorro', nombre: '🦊 Invocar Zorro Guardián', costoKi: 15, mult: 1.4, invocacion: true },
    desc: 'Espíritus aliados y apoyo.',
  },
  medium: {
    clave: 'medium', nombre: '👻 Médium Yūrei', claseBase: 'invocador', rama: 'oscura',
    requisito: 15, costo: 0,
    hpBase: 90, atkBase: 19, defBase: 5, desc: 'Maldiciones y robo de vida.',
    pasiva: {
      clave: 'susurro_oscuro', nombre: 'Susurro Oscuro',
      desc: '15% del daño infligido se convierte en HP.',
      descMayor: '25% del daño infligido se convierte en HP.',
      efecto: { roboHpPct: 0.15 },
      efectoMayor: { roboHpPct: 0.25 },
    },
    habilidadFirma: { clave: 'susurro_espectral', nombre: '👻 Susurro Espectral', costoKi: 14, mult: 1.7, elemento: 'sombra', robaVida: 0.1 },
    desc: 'Maldiciones y robo de vida.',
  },
  // Mago -> Onmyōji / Hechicero Elemental
  onmyoji: {
    clave: 'onmyoji', nombre: '📜 Onmyōji', claseBase: 'mago', rama: 'sellos',
    requisito: 15, costo: 0,
    hpBase: 95, atkBase: 24, defBase: 7, desc: 'Control y apoyo con sellos.',
    pasiva: {
      clave: 'sellos_ancestrales', nombre: 'Sellos Ancestrales',
      desc: 'Encadenar 3 elementos da +25% daño.',
      descMayor: 'Encadenar 4 elementos da +40% daño.',
      efecto: { secuencia: ['fuego', 'viento', 'rayo'], bonusPct: 0.25 },
      efectoMayor: { secuencia: ['fuego', 'viento', 'rayo', 'agua'], bonusPct: 0.40 },
    },
    habilidadFirma: { clave: 'sello_cadenas', nombre: '⛓️ Sello de Cadenas', costoKi: 14, mult: 1.7, elemento: 'agua', estado: 'congelado', turnos: 1 },
    desc: 'Control y apoyo con sellos.',
  },
  hechicero: {
    clave: 'hechicero', nombre: '🔥 Hechicero Elemental', claseBase: 'mago', rama: 'caos',
    requisito: 15, costo: 0,
    hpBase: 88, atkBase: 27, defBase: 5, desc: 'Daño máximo en área.',
    pasiva: {
      clave: 'caos_elemental', nombre: 'Caos Elemental',
      desc: '+20% de daño elemental y críticos +15%.',
      descMayor: '+30% de daño elemental y críticos +25%.',
      efecto: { dmgElementalPct: 0.20, critProb: 0.15 },
      efectoMayor: { dmgElementalPct: 0.30, critProb: 0.25 },
    },
    habilidadFirma: { clave: 'lanza_prismatica', nombre: '🌈 Lanza Prismática', costoKi: 22, mult: 2.5, elemento: 'rayo' },
    desc: 'Daño máximo en área.',
  },
  // Arquero -> Francotirador / Guardabosques
  francotirador: {
    clave: 'francotirador', nombre: '🎯 Francotirador', claseBase: 'arquero', rama: 'precision',
    requisito: 15, costo: 0,
    hpBase: 108, atkBase: 24, defBase: 7, desc: 'Un disparo, un objetivo menos.',
    pasiva: {
      clave: 'ojo_de_halcon', nombre: 'Ojo de Halcón',
      desc: '+18% probabilidad de crítico y +0.5 al multiplicador.',
      descMayor: '+25% probabilidad de crítico y +0.8 al multiplicador.',
      efecto: { critProb: 0.18, critMult: 0.5 },
      efectoMayor: { critProb: 0.25, critMult: 0.8 },
    },
    habilidadFirma: { clave: 'disparo_perforante', nombre: '🎯 Disparo Perforante', costoKi: 18, mult: 2.0, elemento: 'viento' },
    desc: 'Un disparo, un objetivo menos.',
  },
  guardabosques: {
    clave: 'guardabosques', nombre: '🌿 Guardabosques', claseBase: 'arquero', rama: 'naturaleza',
    requisito: 15, costo: 0,
    hpBase: 115, atkBase: 21, defBase: 9, desc: 'Control y daño en área.',
    pasiva: {
      clave: 'trampa_espinas', nombre: 'Trampa de Espinas',
      desc: '+15% ATK y los ataques infligen sangrado 2 turnos.',
      descMayor: '+25% ATK y los ataques infligen sangrado 3 turnos.',
      efecto: { atkPct: 0.15 },
      efectoMayor: { atkPct: 0.25 },
    },
    habilidadFirma: { clave: 'trampa_espinas_h', nombre: '🌿 Trampa de Espinas', costoKi: 20, mult: 1.8, elemento: 'agua', estado: 'sangrado', turnos: 2 },
    desc: 'Control y daño en área.',
  },
};

// ---------------------------------------------------------------------------
// 3. CLASES AVANZADAS (nivel 35)
// Cada rama tiene dos opciones de clase avanzada.
// ---------------------------------------------------------------------------
const CLASES_AVANZADAS = {
  // Espadachín -> Shōgun / Kensei
  shogun_carmesi: {
    clave: 'shogun_carmesi', nombre: '🏯 Shōgun Carmesí', claseBase: 'espadachin', subclase: 'samurai',
    requisito: 35, costo: 0,
    hpBase: 200, atkBase: 28, defBase: 20,
    desc: 'Tanque con contraataques demoledores.',
    pasiva: {
      clave: 'decreto_carmesí', nombre: 'Decreto Carmesí',
      desc: '+40% DEF y +30% ATK bajo 50% HP; contraataca al 50% del daño recibido.',
      descMayor: '+60% DEF y +50% ATK bajo 60% HP; contraataca al 75% del daño.',
      efecto: { umbralHp: 0.5, defPct: 0.40, atkPct: 0.30, contraataquePct: 0.50 },
      efectoMayor: { umbralHp: 0.6, defPct: 0.60, atkPct: 0.50, contraataquePct: 0.75 },
    },
    ougi: { clave: 'decreto_carmesí_final', nombre: '⚔️ Ougi: Decreto Carmesí', costoKi: 60, mult: 4.5, elemento: 'fuego' },
  },
  kensei_avanzado: {
    clave: 'kensei_avanzado', nombre: '⚔️ Kensei', claseBase: 'espadachin', subclase: 'robin',
    requisito: 35, costo: 0,
    hpBase: 185, atkBase: 32, defBase: 14,
    desc: 'Duelista de críticos letales.',
    pasiva: {
      clave: 'viento_errante', nombre: 'Viento Errante',
      desc: '+25% esquiva y crítico +25% tras esquivar.',
      descMayor: '+40% esquiva y crítico +50% tras esquivar.',
      efecto: { esquiva: 0.25, critProb: 0.25, golpePostEsquiva: 0.50 },
      efectoMayor: { esquiva: 0.40, critProb: 0.50, golpePostEsquiva: 0.75 },
    },
    ougi: { clave: 'corte_viento_eterno', nombre: '☄️ Ougi: Corte del Viento Eterno', costoKi: 55, mult: 3.8, elemento: 'viento' },
  },
  // Ladrón -> Asesino / Rey de los Ladrones
  asesino: {
    clave: 'asesino', nombre: '🗡️ Asesino', claseBase: 'ladron', subclase: 'ninja',
    requisito: 35, costo: 0,
    hpBase: 130, atkBase: 34, defBase: 9,
    desc: 'Daño explosivo a un objetivo.',
    pasiva: {
      clave: 'ejecucion_silente', nombre: 'Ejecución Silente',
      desc: '+40% daño a objetivos bajo 50% HP y crítico siempre contra aturdidos.',
      descMayor: '+60% daño a objetivos bajo 60% HP y crítico siempre contra aturdidos.',
      efecto: { dmgPctVidaBaja: 0.40, critContraAturdido: 1.0 },
      efectoMayor: { dmgPctVidaBaja: 0.60, critContraAturdido: 1.0 },
    },
    ougi: { clave: 'ejecucion_final', nombre: '⚔️ Ougi: Ejecución Final', costoKi: 55, mult: 4.2, elemento: 'sombra' },
  },
  rey_ladrones: {
    clave: 'rey_ladrones', nombre: '👑 Rey de los Ladrones', claseBase: 'ladron', subclase: 'bandido',
    requisito: 35, costo: 0,
    hpBase: 145, atkBase: 27, defBase: 11,
    desc: 'Oro, debuffs y críticos.',
    pasiva: {
      clave: 'suerte_suprema', nombre: 'Suerte Suprema',
      desc: '+28% probabilidad de crítico y roba el 25% del daño como oro.',
      descMayor: '+35% probabilidad de crítico y roba el 35% del daño como oro.',
      efecto: { critProb: 0.28, robaOroPct: 0.25 },
      efectoMayor: { critProb: 0.35, robaOroPct: 0.35 },
    },
    ougi: { clave: 'saqueo_real', nombre: '💰 Ougi: Saqueo Real', costoKi: 55, mult: 3.6, elemento: null, robaOro: 0.3 },
  },
  // Invocador -> Señor Celestial / Nigromante Real
  senor_celestial: {
    clave: 'senor_celestial', nombre: '👑 Señor Celestial', claseBase: 'invocador', subclase: 'shikigami',
    requisito: 35, costo: 0,
    hpBase: 130, atkBase: 23, defBase: 10,
    desc: 'Espíritus aliados y apoyo.',
    pasiva: {
      clave: 'vinculo_celestial', nombre: 'Vínculo Celestial',
      desc: 'El espíritu activo hereda el 90% de tus stats y otorga +20% ATK al equipo.',
      descMayor: 'El espíritu activo hereda el 110% de tus stats y otorga +35% ATK al equipo.',
      efecto: { heredaPct: 0.9, bonusAtkEquipo: 0.20 },
      efectoMayor: { heredaPct: 1.1, bonusAtkEquipo: 0.35 },
    },
    ougi: { clave: 'descenso_guardián', nombre: '🌟 Ougi: Descenso del Guardián', costoKi: 60, mult: 4.0, elemento: 'luz' },
  },
  nigromante_real: {
    clave: 'nigromante_real', nombre: '👑 Nigromante Real', claseBase: 'invocador', subclase: 'medium',
    requisito: 35, costo: 0,
    hpBase: 120, atkBase: 26, defBase: 8,
    desc: 'Señor absoluto de los muertos.',
    pasiva: {
      clave: 'ejercito_espectral', nombre: 'Ejército Espectral',
      desc: 'Invoca 2 espíritus adicionales y roba el 25% del daño como vida.',
      descMayor: 'Invoca 3 espíritus adicionales y roba el 35% del daño como vida.',
      efecto: { espiritusExtra: 2, robaVidaPct: 0.25 },
      efectoMayor: { espiritusExtra: 3, robaVidaPct: 0.35 },
    },
    ougi: { clave: 'ejercito_espectral_final', nombre: '👑 Ougi: Ejército Espectral', costoKi: 60, mult: 3.5, elemento: 'sombra', espiritus: 3 },
  },
  // Mago -> Maestro de los Sellos / Archimago del Vacío
  maestro_sellos: {
    clave: 'maestro_sellos', nombre: '📜 Maestro de los Sellos', claseBase: 'mago', subclase: 'onmyoji',
    requisito: 35, costo: 0,
    hpBase: 115, atkBase: 29, defBase: 9,
    desc: 'Control y apoyo con sellos.',
    pasiva: {
      clave: 'sello_silencio_eterno', nombre: 'Sello del Silencio Eterno',
      desc: 'Encadenar 4 elementos da +50% daño y silencia al objetivo 2 turnos.',
      descMayor: 'Encadenar 5 elementos da +70% daño y silencia al objetivo 3 turnos.',
      efecto: { secuencia: ['fuego', 'viento', 'rayo', 'agua'], bonusPct: 0.50, silencia: true, turnosSilencio: 2 },
      efectoMayor: { secuencia: ['fuego', 'viento', 'rayo', 'agua', 'luz'], bonusPct: 0.70, silencia: true, turnosSilencio: 3 },
    },
    ougi: { clave: 'sello_silencio_final', nombre: '⛓️ Ougi: Sello del Silencio Eterno', costoKi: 60, mult: 4.1, elemento: 'agua', silencia: true, turnos: 3 },
  },
  archimago_vacio: {
    clave: 'archimago_vacio', nombre: '🌌 Archimago del Vacío', claseBase: 'mago', subclase: 'hechicero',
    requisito: 35, costo: 0,
    hpBase: 105, atkBase: 35, defBase: 7,
    desc: 'Daño máximo en área.',
    pasiva: {
      clave: 'vacio_absoluto', nombre: 'Vacío Absoluto',
      desc: '+45% daño elemental y ignora 50% de la DEF enemiga.',
      descMayor: '+60% daño elemental y ignora 70% de la DEF enemiga.',
      efecto: { dmgElementalPct: 0.45, ignoraDefPct: 0.50 },
      efectoMayor: { dmgElementalPct: 0.60, ignoraDefPct: 0.70 },
    },
    ougi: { clave: 'colapso_vacio', nombre: '🌌 Ougi: Colapso del Vacío', costoKi: 65, mult: 4.5, elemento: 'sombra', area: true },
  },
  // Arquero -> Tirador Espectral / Domador de Tormentas
  tirador_espectral: {
    clave: 'tirador_espectral', nombre: '🎯 Tirador Espectral', claseBase: 'arquero', subclase: 'francotirador',
    requisito: 35, costo: 0,
    hpBase: 140, atkBase: 31, defBase: 9,
    desc: 'Crítico a distancia.',
    pasiva: {
      clave: 'mira_mortal', nombre: 'Mira Mortal',
      desc: '+30% probabilidad de crítico y crítico hace daño doble.',
      descMayor: '+40% probabilidad de crítico y crítico hace daño triple.',
      efecto: { critProb: 0.30, critMult: 2.0 },
      efectoMayor: { critProb: 0.40, critMult: 3.0 },
    },
    ougi: { clave: 'flecha_espectral', nombre: '☄️ Ougi: Flecha Espectral Única', costoKi: 60, mult: 4.3, elemento: 'luz' },
  },
  domador_tormentas: {
    clave: 'domador_tormentas', nombre: '⛈️ Domador de Tormentas', claseBase: 'arquero', subclase: 'guardabosques',
    requisito: 35, costo: 0,
    hpBase: 150, atkBase: 26, defBase: 12,
    desc: 'Control y daño en área.',
    pasiva: {
      clave: 'tormenta_viva', nombre: 'Tormenta de Flechas Viva',
      desc: 'Los ataques encadenan rayo y aplican sangrado 2 turnos.',
      descMayor: 'Los ataques encadenan rayo y aplican sangrado 3 turnos + aturdir 1 turno.',
      efecto: { dmgElementalPct: 0.25, estado: 'sangrado', turnos: 2 },
      efectoMayor: { dmgElementalPct: 0.35, estado: 'sangrado', turnos: 3, estado2: 'aturdido', turnos2: 1 },
    },
    ougi: { clave: 'tormenta_flechas', nombre: '⚡ Ougi: Tormenta de Flechas Viva', costoKi: 60, mult: 3.6, elemento: 'rayo', area: true },
  },
};

const classLabel = (key) => {
  const c = CLASSES[key] || SUBCLASES[key] || CLASES_AVANZADAS[key];
  return c ? c.nombre : key;
};

// Helpers de crecimiento/ki/vel/pasiva por clase (usados por stats.js)
const getGrowth = (key) => {
  const c = CLASSES[key] || SUBCLASES[key] || CLASES_AVANZADAS[key];
  if (c && c.crec) return c.crec;
  // Heredar de clase base
  const base = c ? c.claseBase : null;
  return base ? (CLASSES[base] || SUBCLASES[base] || CLASES_AVANZADAS[base])?.crec : null;
};

const kiBaseDe = (key) => {
  const c = CLASSES[key] || SUBCLASES[key] || CLASES_AVANZADAS[key];
  return c ? c.kiBase : KI_SIN_CLASE;
};

const velBaseDe = (key) => {
  const c = CLASSES[key] || SUBCLASES[key] || CLASES_AVANZADAS[key];
  return c ? c.velBase : VEL_SIN_CLASE;
};

const pasivaDe = (key, despertarMayor = false) => {
  const c = CLASSES[key] || SUBCLASES[key] || CLASES_AVANZADAS[key];
  if (!c) return null;
  const p = c.pasiva;
  if (!p) return null;
  const efecto = (despertarMayor && p.efectoMayor) || p.efecto || {};
  return { ...p, efecto, mayor: despertarMayor && !!p.efectoMayor };
};

module.exports = {
  CLASSES,
  SUBCLASES,
  CLASES_AVANZADAS,
  KI_SIN_CLASE,
  VEL_SIN_CLASE,
  getClass: (key) => CLASSES[key] || SUBCLASES[key] || CLASES_AVANZADAS[key] || null,
  getSubclase: (key) => SUBCLASES[key] || null,
  getClaseAvanzada: (key) => CLASES_AVANZADAS[key] || null,
  classLabel,
  getGrowth,
  kiBaseDe,
  velBaseDe,
  pasivaDe,
  baseClassKey: (key) => {
    const c = CLASSES[key] || SUBCLASES[key] || CLASES_AVANZADAS[key];
    return c ? c.claseBase || key : key;
  },
};
