// Tablas de migración entre fases — puro DATA, sin lógica.
// Estas tablas se aplican de forma perezosa (ver core/migrate.js): solo renombran
// cuando el destino ya existe en data/, así se activan solas cuando la fase
// correspondiente agregue los datos.

// FASE B — clases renombradas estilo anime (tabla del prompt maestro).
// Clases viejas → nuevas clases base.
// Evoluciones viejas → subclases nuevas.
const CLASS_MAP = {
  // Clases base viejas → nuevas
  guerrero: 'espadachin',
  mago: 'mago',
  arquero: 'arquero',
  pícaro: 'ladron',
  invocador: 'invocador',
  nigromante: 'invocador',
  kensei: 'espadachin',
  shinobi: 'ladron',
  onmyoji: 'mago',
  hayate: 'arquero',
  shikigami: 'invocador',
  medium_yurei: 'invocador',
  // Evoluciones viejas → subclases nuevas
  asesino: 'ninja',
  gran_arquero: 'francotirador',
  caballero: 'samurai',
  archimago: 'hechicero',
  shogun_carmesi: 'samurai',
  hoja_celestial: 'robin',
  sombra_carmesi: 'ninja',
  maestro_ilusiones: 'bandido',
  maestro_sellos: 'onmyoji',
  archimago_vacio: 'hechicero',
  francotirador_espectral: 'francotirador',
  domador_tormentas: 'guardabosques',
  senior_bestias: 'shikigami',
  pacto_celestial: 'medium',
  nigromante_real: 'medium',
  ejecutor_espectral: 'medium',
};

// FASE 9 — conversión de armas viejas por tier/rareza.
// "Puños/básicas a Común, hierro y similares a Raro, acero a Épico,
//  dragón/elfo/arcano/sombría a Legendario."
const ARMAS_RAREZA = {
  nada: 'Comun',
  // tier 1 (hierro y similares)
  espada_hierro: 'Raro',
  arco_corto: 'Raro',
  baston_madera: 'Raro',
  daga_aguda: 'Raro',
  // tier 2 (acero y similares)
  espada_acero: 'Epico',
  arco_largo: 'Epico',
  baston_cristal: 'Epico',
  daga_venenosa: 'Epico',
  // tier 3 (legendarias)
  espada_dragón: 'Legendario',
  arco_elfico: 'Legendario',
  baston_arca: 'Legendario',
  daga_sombría: 'Legendario',
};

module.exports = { CLASS_MAP, ARMAS_RAREZA };
