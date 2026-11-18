// CLI del RPG para inspección rápida (sin levantar el bot).
// Uso:
//   node tools/cli.js stats <clase>       -> stats base de la clase
//   node tools/cli.js enemies             -> lista de enemigos
//   node tools/cli.js bosses              -> lista de jefes
//   node tools/cli.js skills <clase>      -> skills de la clase (o su base)
//   node tools/cli.js titles              -> títulos y condiciones
//   node tools/cli.js missions [nivel]    -> misiones disponibles (default nivel 1)
//   node tools/cli.js lock <id>           -> prueba del lock por jugador

const rpg = require('../lib/rpg');

const [cmd, arg, arg2] = process.argv.slice(2);

const statsDeClase = (clase) => {
  const u = { cash: 0, bank: 0 };
  rpg.ensureRPG(u);
  u.rpg.clase = clase;
  const s = rpg.getStats(u);
  console.log(`${s.clase} — ATK ${s.atk} | DEF ${s.def} | HP ${s.hp} | EXP/nivel ${s.expSiguiente}`);
};

const listarEnemigos = () => {
  for (const [k, e] of Object.entries(rpg.ENEMIES)) {
    console.log(`${k.padEnd(12)} ${e.nombre.padEnd(20)} HP ${e.hp}  ATK ${e.atk}  EXP ${e.exp}  ¥${e.oro}`);
  }
};

const listarJefes = () => {
  for (const [k, b] of Object.entries(rpg.BOSSSES)) {
    console.log(`${k.padEnd(14)} ${b.nombre.padEnd(24)} HP ${b.hp}  ATK ${b.atk}  dif ${b.dificultad}  ¥${b.oro}`);
  }
};

const listarSkills = (clase) => {
  const base = rpg.baseClassKey(clase);
  const skills = rpg.SKILLS[base] || {};
  console.log(`Skills de ${rpg.classLabel(clase)} (base: ${base}):`);
  for (const [k, s] of Object.entries(skills)) {
    console.log(`  ${k.padEnd(18)} ${s.nombre} — ${s.descripcion} (¥${s.costo})`);
  }
  if (!Object.keys(skills).length) console.log('  (ninguna)');
};

const listarTitulos = () => {
  for (const [k, t] of Object.entries(rpg.TITLES)) {
    console.log(`${k.padEnd(12)} ${t.nombre} — ${t.descripcion}  bonus: ${JSON.stringify(t.bonus)}`);
  }
};

const listarMisiones = (nivel) => {
  const n = parseInt(nivel, 10) || 1;
  for (const m of rpg.getAvailableMissions(n)) {
    console.log(`${m.key.padEnd(12)} ${m.nombre} — ${m.objetivo} (¥${m.recompensa}, ${m.exp} EXP, dif ${m.dificultad})`);
  }
};

const probarLock = async (id) => {
  console.log(`Lock para "${id}":`);
  const orden = [];
  await Promise.all([
    rpg.withLock(id, async () => { orden.push('A-inicio'); await new Promise((r) => setTimeout(r, 50)); orden.push('A-fin'); }),
    rpg.withLock(id, async () => { orden.push('B-inicio'); orden.push('B-fin'); }),
  ]);
  console.log('  orden:', orden.join(' -> '));
  console.log('  correcto (serializado):', orden.join(',') === 'A-inicio,A-fin,B-inicio,B-fin');
};

const main = async () => {
  switch (cmd) {
    case 'stats': return statsDeClase(arg || 'kensei');
    case 'enemies': return listarEnemigos();
    case 'bosses': return listarJefes();
    case 'skills': return listarSkills(arg || 'kensei');
    case 'titles': return listarTitulos();
    case 'missions': return listarMisiones(arg);
    case 'lock': return probarLock(arg || 'test');
    default:
      console.log('Uso: node tools/cli.js <stats|enemies|bosses|skills|titles|missions|lock> [arg]');
  }
};

main().catch((e) => { console.error(e); process.exit(1); });
