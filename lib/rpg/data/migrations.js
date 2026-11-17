// Tablas de migración entre fases — puro DATA, sin lógica.
// Estas tablas se aplican de forma perezosa (ver core/migrate.js): solo renombran
// cuando el destino ya existe en data/, así se activan solas cuando la fase
// correspondiente agregue los datos.

// FASE 4 — clases renombradas estilo anime (tabla del prompt maestro).
const CLASS_MAP = {
  guerrero: 'kensei',
  mago: 'onmyoji',
  arquero: 'hayate',
  pícaro: 'shinobi',
  invocador: 'shikigami',
  nigromante: 'medium_yurei',
  // FASE 4 agregará las evoluciones:
  // asesino -> sombra_carmesi, caballero -> ..., etc.
};

// FASE 9 — conversión de armas viejas por tier/rareza.
// "Puños/básicas a Común, hierro y similares a Raro, acero a Épico,
//  dragón/elfo/arcano/sombría a Legendario."
const ARMAS_RAREZA = {
  nada: 'Común',
  // tier 1 (hierro y similares)
  espada_hierro: 'Raro',
  arco_corto: 'Raro',
  baston_madera: 'Raro',
  daga_aguda: 'Raro',
  // tier 2 (acero y similares)
  espada_acero: 'Épico',
  arco_largo: 'Épico',
  baston_cristal: 'Épico',
  daga_venenosa: 'Épico',
  // tier 3 (legendarias)
  espada_dragón: 'Legendario',
  arco_elfico: 'Legendario',
  baston_arca: 'Legendario',
  daga_sombría: 'Legendario',
};

module.exports = { CLASS_MAP, ARMAS_RAREZA };
