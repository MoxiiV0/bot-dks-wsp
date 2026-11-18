# Arquitectura del RPG (rework anime)

Estado: **FASE 1 (arquitectura) + FASE 2 (esquema v2 y migración) + FASE 3
(progresión y stats) + FASE 4 (clases anime) + FASE 5 (motor de combate
unificado) + FASE 6 (mundo, zonas y enemigos) + FASE 7 (portales) +
FASE 8 (arcos narrativos) + FASE 9 (equipo, loot y forja) completas**.
Las fases siguientes (10-16) irán rellenando los placeholders señalados.

## Estructura

```
lib/rpg.js              ← fachada legacy: SOLO re-exporta ./rpg/index.js (no tocar lógica acá)
lib/rpg/
  index.js              ← compone data/ + core/ y expone la API completa
  data/                 ← TODO el contenido es DATA (cero números mágicos en la lógica)
    classes.js          ← CLASSES (kensei/onmyoji/hayate/shinobi) + NUEVAS_CLASES
                          (shikigami/medium_yurei, nv10) + CLASES_EVOLUCION (12 ramas)
                          + EVOLUCIONES_CLASE (2 ramas por clase, nv15) + DESPERTAR_MAYOR
                          (nv35) + pasivas (pasivaDe con efecto/efectoMayor),
                          crec{hp,ki,atk,def}, kiBase, velBase, getGrowth/kiBaseDe/
                          velBaseDe (las ramas heredan de la base)
    skills.js           ← SKILLS_V2 + KITS_POR_CLASE (kits FASE 5, DATA pura) +
                          SKILLS_ALIAS (legacy → v2 para #hab),
                          SKILLS, COMBINACIONES_SKILLS, HABILIDADES_POR_NIVEL,
                          HABILIDADES_ESPECIALES (legado re-claveado a clases FASE 4)
    enemies.js          ← ENEMIES, BOSSSES (FASE 5: def/vel/arquetipo/elemento;
                          los jefes usan arquetipo 'jefe')
    zones.js            ← EVENTOS_MAZMORRA, MISSIONS, GUILD_RANKS
    items.js            ← WEAPONS, HOUSES, CHESTS (+objProb), OBJETOS_COMBATE
                          (FASE 5: pocion_hp/pocion_ki/elixir/antidoto/talisman),
                          WEAPON_CLASSES, MANA, ENTRENAMIENTO, DESCANSO, REGEN
                          + FASE 9: RAREZAS (Comun/Raro/Epico/Legendario/Mitico),
                          FAMILIAS_ARMA (katana, tomo, arco yumi, kodachi,
                          talismán, campana fúnebre), EQUIPO_BASE, MATERIALES,
                          MATERIAL_COSTO_MEJORA, AFIJOS, AFIJOS_POR_RAREZA,
                          SETS, PIEZA_SET, DURABILIDAD
    ranks.js            ← RANGOS (E..S + nivel de examen), EXAMENES (jefes de
                          prueba con hp/atk/def/vel — balance FASE 5)
    battle.js           ← FASE 5: BATALLA (fórmula, crítico, defensa, telegrafía,
                          Despertar, derrota, huida, límite 25 turnos FASE 6),
                          ELEMENTOS, ARQUETIPOS
    world.js            ← FASE 6: ZONAS (6 zonas, 42 enemigos con nivel/tipo/
                          elemento/arquetipo), ZONA_INICIAL, ESCALADO (HP/ATK/
                          DEF por nivel, multipliers élite/jefe, EXP/oro, pesos
                          de caza)
    portals.js          ← FASE 7: PORTAL (pisos 55/25/10/10, dificultad +4%,
                          llaves 3/día, jefe cada 10, muerte −50%, ranking)
                          + EVENTOS_PORTAL (los 5 eventos viejos con efectos
                          reales: oro, HP/Ki, cura, bono temporal, EXP)
    arcs.js             ← FASE 8: ARCS (4 arcos x 8 capítulos con diálogo,
                          combate/prueba, recompensa y "Próximo episodio")
    arcs.js             ← ARCS (FASE 8, placeholder)
    titles.js           ← TITLES (condición + bonus)
    statuses.js         ← STATUSES (FASE 5: 8 estados con duración/pila/DOT/textos)
    migrations.js       ← CLASS_MAP (FASE 4), ARMAS_RAREZA (FASE 9: conversión
                          de armas viejas por tier/rareza) — puro DATA
  core/                 ← lógica en funciones puras cuando sea posible
    narrate.js          ← rand, pick, money, classLabel, weaponLabel, barra (formato WhatsApp)
    curve.js            ← expToNext(L)=ceil(40*L^1.65), MAX_LEVEL=60
    migrate.js          ← ensureRPG (v1+proyecciones), migración v1→v2 perezosa, dry-run, log,
                          back-pay de puntos (puntosOtorgados, una sola vez)
    stats.js            ← getStats (fórmula FASE 3 + regen por tiempo), hpMaxDe, gremio/casa
    progression.js      ← addExp (puntos + curación 20%), invertirPunto, reiniciarPuntos,
                          descansar, títulos, evolucionarClase (2 ramas + 'mayor'),
                          habilidades, misiones
    ranks.js            ← getRango, examenActual, ascenderRango (rangos de Cazador)
    effects.js          ← FASE 5: kitDe/resolveHabilidad (#hab: número/id/alias,
                          nivel/Ki/cooldown/ougi) + useSkill/combinarSkills (legado)
    equipo.js           ← FASE 9: equipoDe, equipar, desequipar, bonosEquipo,
                          forjar (oro + materiales), mejorar (+1 a +10, riesgo),
                          reparar (durabilidad), gastarDurabilidad (post-combate),
                          listarEquipo, CATALOGO, obtenerItem, crearItem
    ai.js               ← FASE 5: confIANZA, faseActual (70/40/15%), decidirIA
                          (atacar/cargar/defender por arquetipo)
    combat.js           ← FASE 5: motor unificado startCombat/combatTurn
                          (iniciativa VEL, daño por DEF, crítico/esquiva con tope,
                          elementos, #def, estados, telegrafía, Despertar,
                          derrota inconsciente, huida, límite, expiración 10 min,
                          pasivas, doma shikigami, botín de objetos)
    loot.js             ← openChest (+objProb → OBJETOS_COMBATE), generarEventoMazmorra
    world.js            ← FASE 6: statsEscala, recompensas, enemigoZona,
                          zonaActual (perezosa), zonaPorNivel, puedeViajar/
                          viajar (nivel + rango, bloqueado en combate), cazar
                          (peso 80/20, jefe solo explícito), listaZonas
    portal.js           ← FASE 7: llavesDisponibles (3/día), abrirPortal,
                          avanzarPortal (sorteo de piso), retirarPortal,
                          portalPostCombate (victoria/muerte/huida),
                          estadoPortal, enemigoPortal (dificultad +4%/piso),
                          registrarRanking/rankingGrupo (semana ISO)
    arcs.js             ← FASE 8: arcoActual (perezoso), iniciarCapitulo
                          (combate/prueba), listarArcos, arcoPostCombate
                          (cierra capítulo tras victoria), ARCS
    lock.js             ← withLock/isLocked: un lock por jugador
tools/
  simulate.js           ← npm run sim — winrate/turnos por clase vs enemigo
  examen-sim.js         ← node tools/examen-sim.js — balance de exámenes por clase/rango
  cli.js                ← npm run cli — inspección de datos y prueba del lock
  smoke-fase2.js        ← npm test — 33 comprobaciones de esquema/migración
  smoke-fase3.js        ← npm test — 27 comprobaciones de progresión/stats/rangos
  smoke-fase4.js        ← npm test — 13 comprobaciones de clases/evoluciones/pasivas
  smoke-fase5.js        ← npm test — 28 comprobaciones del motor de combate
  smoke-fase6.js        ← npm test — 30 comprobaciones de zonas/escalado/viaje/caza
  smoke-fase7.js        ← npm test — 32 comprobaciones de portales (pisos/botín/ranking)
  smoke-fase8.js        ← npm test — 19 comprobaciones de arcos narrativos
  smoke-fase9.js        ← npm test — 23 comprobaciones de equipo/loot/forja
docs/RPG.md             ← este archivo
```

## Reglas

1. **Los comandos de `index.js` solo parsean, llaman al módulo y envían el texto.**
   La lógica vive en `lib/rpg/core/`.
2. **Nada de estado en `globalThis`.** El estado del jugador vive en `u.rpg`
   (persistido por la economía con `markEconDirty()`). Las sesiones temporales
   (mazmorra/portales) viven en un Map propio, no en globals sueltos.
3. **Un lock por jugador** (`rpg.withLock(id, fn)`), aplicado en `processCommand`:
   ningún comando/combate de un mismo usuario avanza dos veces a la vez.
4. **Las funciones devuelven `{ resultado | mensaje, ... }` y el caller formatea.**
   Textos en español neutral, <1500 chars, formato WhatsApp (`*negrita*`, `_cursiva_`).
5. **Cero IP de terceros:** sin Kamehameha, Rasengan, Bankai, etc.

## Esquema v2 (`u.rpg.v === 2`) — FASE 2

```js
{ v, clase, evolucion, nivel, exp, hp, ki, kiMax, despertar (0-100),
  puntos (sin gastar), puntosOtorgados (back-pay hecho), atributos {atk,def,hp,ki,vel},
  equipo {arma, armadura, accesorio, reliquia}, inventario {id: cantidad},
  habilidades {id: nivel}, cooldowns {}, estados [], combate (null o estado),
  portal (null o estado), compañeros [], vinculos {}, rival {nivel, victorias, derrotas},
  arco {id, capitulo}, rango ('E'..'S'), titulos [], tituloEquipado,
  stats {kills, pisos, muertes, duelos}, ultimaRegen, inconscienteHasta }
```

Más los campos legados que siguen vivos hasta sus fases: `armas`, `casa`,
`gremio`, `misiones`, `pescado`, `minerales`, `aventureros`, `aprendiz`,
`entrenamiento`, `statsTrabajos/Crimenes`, `maxBank`, `bestiasDomadas`, etc.

### Migración v1 → v2 (`core/migrate.js`)

- **Perezosa:** corre dentro de `ensureRPG` la primera vez que el jugador usa
  un comando RPG. Guarda: `if (r.v < 2) migrarAV2(u)`.
- **Idempotente:** segunda llamada no cambia nada (verificado en el smoke test).
- **dry-run:** `rpg.migrate(u, {dryRun: true})` devuelve
  `{anadidas[], modificadas[], cambios[]}` sin tocar el estado.
- **Log:** cada migración con datos previos queda en `logs/rpg-migraciones.log`
  (una línea JSON con cambios antes/después).
- Conversiones: `mana → ki` (barra llena), `entrenamiento → atributos`,
  `stats planos → stats {…}` (v2 es fuente de verdad; `sincronizarProyecciones`
  espeja v2→v1 en cada `ensureRPG` para los lectores legacy), `exp → curva
  ceil(40*L^1.65)` sin bajar de nivel, `equipo.arma ← arma`, `titulos ←
  titulosDesbloqueados` (misma referencia), `cooldowns === cd` (helper `rpgLeft`).
- **Renombrado FASE 4 (ACTIVO):** `CLASS_MAP` en `data/migrations.js` se aplica
  de forma perezosa en cada `ensureRPG` y **solo si el destino existe en data/** —
  hoy ya renombra: `guerrero→kensei`, `mago→onmyoji`, `arquero→hayate`,
  `pícaro→shinobi`, `invocador→shikigami`, `nigromante→medium_yurei` y las
  evoluciones viejas (`asesino→sombra_carmesi`, `caballero→shogun_carmesi`,
  `gran_arquero→francotirador_espectral`, `archimago→archimago_vacio`).
  `ARMAS_RAREZA` seguirá no-op hasta la FASE 9.

## API principal (fachada `require('./lib/rpg')`)

| Área | Funciones |
|------|-----------|
| Estado | `ensureRPG(u)`, `migrate(u, {dryRun})` |
| Stats | `getStats(u)`, `hpMaxDe(u)`, `getStatsCompletos(u)` |
| Progresión | `addExp(u, n)`, `invertirPunto(u, clave, n)`, `reiniciarPuntos(u)`, `descansar(u)`, `checkTitles(u)`, `unlockTitle(u, key)`, `evolucionarClase(u, rama | 'mayor')` |
| Rangos | `getRango(u)`, `examenActual(u)`, `ascenderRango(u, key)` |
| Combate | `startCombat(u, enemyKey, {enemy})`, `combatTurn(u, action, param)` → `{resultado, terminado, tipo}`, `getEnemy(key)`, `puedeCombatir(u)`, `activarDespertar(u)`, `factorElemental(a, b)`, `aplicarEstado(lista, id, turnos)` |
| Efectos | `kitDe(u)`, `resolveHabilidad(u, ref, c)`, `useSkill(u, key)`, `combinarSkills(u, k1, k2)` |
| Botín | `openChest(u, key)`, `generarEventoMazmorra(obj)` |
| Mundo | `zonaActual(u)`, `puedeViajar(u, zona)`, `viajar(u, zona)`, `cazar(u, ref)`, `listaZonas(u)`, `enemigoZona(key)`, `statsEscala(nivel, tipo)`, `recompensas(nivel)` |
| Portal | `abrirPortal(u, rango)`, `avanzarPortal(u)`, `retirarPortal(u)`, `portalPostCombate(u, result)`, `estadoPortal(u)`, `llavesDisponibles(u)`, `enemigoPortal(p)`, `registrarRanking(chats, jid, usuario, pisos)`, `rankingGrupo(chats, jid)` |
| Arcos | `arcoActual(u)`, `iniciarCapitulo(u)`, `listarArcos(u)`, `arcoPostCombate(u, result)`, `ARCS` |
| Lock | `withLock(id, fn)`, `isLocked(id)` |
| Datos | `CLASSES`, `NUEVAS_CLASES`, `CLASES_EVOLUCION`, `EVOLUCIONES_CLASE`, `DESPERTAR_MAYOR`, `pasivaDe`, `getClass`, `baseClassKey`, `SKILLS`, `SKILLS_V2`, `KITS_POR_CLASE`, `SKILLS_ALIAS`, `ENEMIES`, `TITLES`, `WEAPONS`, `OBJETOS_COMBATE`, `BATALLA`, `ELEMENTOS`, `ARQUETIPOS`, `STATUSES`, `RANGOS`, `EXAMENES`, `ENTRENAMIENTO`, `DESCANSO`, `REGEN`, `ZONAS`, `ZONA_INICIAL`, `ESCALADO`, ... (ver `lib/rpg/index.js`) |

`combatTurn` devuelve `tipo`: `'victoria' | 'derrota' | 'escape' | 'limite' | null`.

## Progresión y stats (FASE 3)

- **Fórmula:** `stat final = base de clase + crecimiento * (L-1) + equipo +
  título + casa + puntos de atributo`. El crecimiento vive en
  `data/classes.js` (`crec: {hp, ki, atk, def}`); las evoluciones heredan el de
  su clase base (`getGrowth`).
- **Ki/VEL:** `kiMax = kiBase + crec.ki*(L-1) + puntos ki` (computado en cada
  `getStats`, nunca guardado a mano); `kiBaseDe/velBaseDe` con defaults
  `KI_SIN_CLASE=100` / `VEL_SIN_CLASE=5`.
- **Puntos:** 2 por nivel (`ENTRENAMIENTO.puntosPorNivel`), otorgados por
  `addExp`. Los usuarios legados reciben pago único retroactivo
  `(nivel-1)*2` con la marca `puntosOtorgados` (en `sincronizarProyecciones`).
  `#entrenar atk [n]` invierte; `#reiniciar` los devuelve a cambio de oro
  (`base 500 + 100*nivel` — sumidero).
- **Regeneración por tiempo (sin timers):** `getStats` aplica contra
  `ultimaRegen` HP +1%/min y Ki +2%/min (`REGEN` en data), conservando el
  resto que no llega al minuto. `#descansar` cura 100% por 500 oro con 10 min
  de espera (`DESCANSO`), bloqueado en combate.
- **HP persistente:** el combate arranca con el HP actual (`r.hp`), y al
  terminar (victoria/derrota/escape/límite) el daño sufrido se escribe en
  `r.hp` — la regeneración y el descanso son ahora la forma de recuperarse.
- **addExp:** una sola función maneja todos los niveles ganados, da
  `2*n` puntos, cura 20% de HP/Ki por nivel y limpia EXP en el tope 60.
- **Rangos de Cazador** (`data/ranks.js` + `core/ranks.js`): E (nv1), D (10),
  C (20), B (32), A (45), S (58). `#examen` inicia el combate contra el jefe
  de prueba (`EXAMENES`); la victoria asciende el rango (`ascenderRango`,
  texto en el resultado del combate). `#rango` muestra rango de Cazador +
  rango de gremio.

## Clases, evoluciones y pasivas (FASE 4)

- **Clases primarias** (desde el inicio): ⚔️ Kensei (bruiser), 🔮 Onmyōji
  (daño elemental), 🏹 Cazador Hayate (crítico), 🌑 Shinobi (esquiva).
  **Secundarias** (nivel 10): 🦊 Shikigami (invoca/doma bestias), 👻 Médium
  Yūrei (maldiciones y robo de vida). `#clase` acepta los nombres viejos como
  alias vía `CLASS_MAP` y **ya no resetea nivel/exp**.
- **Prueba de Ascenso** (nivel 15): `EVOLUCIONES_CLASE` da **dos ramas** por
  clase (12 en total, `CLASES_EVOLUCION`). `#evolucionar` lista las ramas con
  su disponibilidad; `#evolucionar <rama>` aplica. Las ramas usan stats propias
  de HP/ATK/DEF y **heredan** crecimiento/ki/VEL/pasiva de su clase base
  (`CLASE_BASE` + `getGrowth/kiBaseDe/velBaseDe/pasivaDe`).
- **Despertar Mayor** (nivel 35): `#evolucionar mayor` marca
  `r.despertarMayor` y `pasivaDe(clave, true)` devuelve `efectoMayor`.
- **Pasivas** (data con `efecto`/`efectoMayor`): Kensei `voluntad_acero` (+DEF
  bajo 30% de HP; +ATK con Despertar Mayor), Médium `susurro` (10%/18% del
  daño en HP) — **ambas ya operan en `combatTurn`**. Onmyōji/Hayate/Shinobi/
  Shikigami requieren mecánicas de la FASE 5/10 (sellos, críticos, esquiva,
  espíritus).
- **Kits FASE 5 en data:** `SKILLS_V2` (24 skills con
  `{id, nombre, clase, nivelReq, costoKi, cooldown, objetivo, efectos, frase,
  banner}`) + `KITS_POR_CLASE` + `SKILLS_ALIAS` (nombres legados → kit v2).
  **Operativos desde la FASE 5:** `#hab <n|id|alias>` los resuelve con
  `resolveHabilidad` (nivel, Ki, cooldown por turnos absolutos, Ougi solo en
  modo Despertar). `#skill` es alias de `#hab`; el sistema legado en oro
  (`useSkill`) solo lo usa `#combinar` hasta la FASE 13.
- **Doma de bestias:** ahora la hace el Shikigami
  (`baseClassKey(clase) === 'shikigami'`), no el viejo `invocador`.

## Motor de combate unificado (FASE 5)

Un solo motor (`core/combat.js`) para caza, portales, jefes, rival y duelos.
El estado vive en `u.rpg.combate` y todas las constantes en `data/battle.js`:

- **Acciones:** `#atk` (alias `#pelear`), `#hab <n>` (alias `#skill`),
  `#def`, `#obj <id>`, `#huir`, más `#despertar` (instante). El inicio es
  `#combate <enemigo>`, `#examen` o `#mazmorra-boss <clave>` — todos bloqueados
  con `puedeCombatir` (inconsciencia).
- **Iniciativa por VEL** (mayor o igual actúa primero). Daño:
  `bruto = ATK * mult * rand(0.9–1.1)`, `final = bruto * 100/(100+DEF)`.
  Crítico 5% + bonos (×1.5), esquiva con tope duro 40%, elementos
  ×1.25/×0.8 (`ELEMENTOS`: fuego>viento>rayo>agua>fuego; luz>sombra).
- **`#def`:** −50% de daño y +8 Ki (una vez por golpe recibido); −70% si el
  golpe enemigo estaba telegrafiado.
- **Estados** (`data/statuses.js`): sangrado, quemadura, veneno, aturdido,
  congelado, escudo, furia, marca — con duración, `maxPila`, DOT y textos.
- **IA** (`core/ai.js`): arquetipos agresivo/defensivo/errático/jefe; los
  jefes (y guardianes de examen) tienen fases al 70/40/15% de HP con cambio
  de patrón y telegrafían sus cargas (×3) un turno antes.
- **Despertar:** medidor 0–100 (+5 al golpear, +15 en crítico, +8 al recibir
  un golpe fuerte ≥12% del HP máx). `#despertar` da 3 turnos (+30% ATK/VEL,
  skills sin Ki, acceso a Ougi) y deja 1 turno de cansancio.
- **Derrota:** −10% del oro en mano, `inconscienteHasta` = 2 min, reaparece
  con 30% de HP. **Huida** por VEL (15–90%). **Límite** 25 turnos (subido de
  15 en la FASE 6 para los jefes de zona; los jefes además cobran 20%).
  **Expiración** por timestamp a los 10 min (sin timers).
- **Pasivas cableadas:** kensei (DEF/ATK bajo umbral), onmyōji (cadena
  fuego→viento→rayo→agua +20%), hayate (crítico +12%/+0.3), shinobi (esquiva
  10% + golpe tras esquivar), médium (robo de vida 10%/18%). Falta `heredaPct`
  de shikigami (invocación, FASE 10).
- **Objetos:** `#obj` consume `OBJETOS_COMBATE` del `r.inventario` (botín 15%
  al vencer y `objProb` en cofres).

La curva de EXP es `expToNext(L) = ceil(40 * L^1.65)` con máximo nivel 60
(`core/curve.js`); el daño del jugador usa `stats.atk` (base + crecimiento +
equipo + puntos) desde la FASE 3.

## Mundo, zonas y enemigos (FASE 6)

Todo el contenido vive en `data/world.js` (DATA pura):

- **6 zonas** (`ZONAS`, claves `sakura/torii/luna/cristal/trueno/abismo`) con
  rango de niveles: Aldea Sakura Rota 1–9, Bosque de los Mil Torii 8–18,
  Ruinas del Templo Lunar 16–28, Desierto de Cristal 26–38, Cumbres del
  Trueno 36–48, Abismo Eclipse 46–60. Cada zona tiene **5 enemigos normales +
  1 élite + 1 jefe** (42 enemigos, claves únicas), cada uno con `nivel`,
  `elemento` y `arquetipo` de IA. Las 3 zonas altas exigen rango de Cazador
  (C/B/A).
- **Escalado por nivel** (`ESCALADO` + `statsEscala`): HP = 45+22·Lv,
  ATK = 8+2.6·Lv, DEF = 3+1.2·Lv; **élite** HP ×1.6 y ATK ×1.25; **jefe**
  HP ×6 y ATK ×1.5 (con fases de IA 70/40/15 heredadas del motor FASE 5).
- **Recompensas** (`recompensas`): EXP = `ceil(expToNext(Lv)/(10+0.25·Lv))`,
  oro = 20+6·Lv con ±20% de variación.
- **`enemigoZona(key)`** normaliza al esquema del motor; `getEnemy` resuelve
  los enemigos de zona primero, así `startCombat`/`#combate` funcionan igual
  que con `ENEMIES`/`BOSSSES`/`EXAMENES`.
- **`#cazar [jefe|<clave>]`**: busca un enemigo al azar de tu zona actual
  (80% normal / 20% élite; el jefe nunca sale al azar: solo con `#cazar jefe`
  o la clave exacta). Bloqueado en combate.
- **`#viajar <zona>`** (sin argumentos: lista con 📍 actual / 🔒 bloqueada /
  ✅ disponible): exige nivel mínimo y, en las zonas altas, rango de Cazador;
  bloqueado en combate. La zona se guarda en `u.rpg.zona` (perezoso:
  arranca en `ZONA_INICIAL='sakura'`). `#estado` muestra la zona actual.
- **Límite de turnos 25** (`BATALLA.limite.turnos`, subido de 15) para que
  las peleas de jefe quepan en el objetivo de 12–20 turnos.

> ⚠️ **Balance pendiente (decisión FASE 6):** con el multiplicador literal
> de jefe HP ×6 / ATK ×1.5, las simulaciones dan ~0% de victoria contra
> jefes (objetivo FASE 15: 50–65% sin pociones). Normales y élites sí caen
> en rango. El reajuste fino queda para la FASE 15 (donde el prompt autoriza
> ajustar datos hasta cumplir los objetivos).

## Portales (FASE 7) — reemplazan la mazmorra

- **`#portal <rango|ranking>`** abre una incursión por pisos guardada en
  `u.rpg.portal` (sin apuesta obligatoria): se gasta **1 llave del día
  (3/día, `r.portalLlaves`, reset por fecha)** o se pagan `PORTAL.costoOro`
  (1000) de oro. Los rangos E–S exigen ese rango de Cazador o superior y
  fijan el nivel base de los enemigos (1/10/20/32/45/58). `#mazmorra` quedó
  como alias de `#portal` (la sesión vieja en `globalThis` y la apuesta
  mínima se eliminaron; `#activar-mazmorra` queda como legado inofensivo
  hasta la FASE 13).
- **Cada piso** (`PORTAL.pisos`): 55% combate, 25% evento, 10% tesoro,
  10% santuario. **Dificultad +4% por piso** (compuesta sobre HP/ATK del
  enemigo, que se genera con `statsEscala` sobre la zona de su rango).
- **`#avanzar`** sortea y resuelve el piso; **`#retirarse`** conserva todo
  el botín (el oro ya está acreditado en `u.cash`); **al morir se pierde el
  50% del botín acumulado** (desde el efectivo, tope 0) y el portal cierra.
  Huir o llegar al límite de turnos cierra conservando. Expiración por
  inactividad a los 60 min (timestamp, sin timers) — también conserva.
- **Jefe de portal cada 10 pisos** (arquetipo `jefe`, fases 70/40/15 del
  motor FASE 5) con botín extra; enemigos élites con peso 20% (`ESCALADO.caza`).
- **Los 5 eventos viejos con efectos reales** (`EVENTOS_PORTAL`): Cofre
  Oculto (+oro al botín), Trampa de Sombras (−15% HP y −30% Ki), Pozo
  Sanador (+60% HP/Ki), Altar del Sacrificio (−25% HP → **+25% ATK durante
  3 combates**, `c.bonoAtk` en el motor), Encuentro Místico (+EXP y Ki al 100%).
- **Ranking semanal por grupo**: `registrarRanking` guarda el top-10 por
  `settings.chats[jid].portalRanking` con clave de semana ISO
  (`semanaClave`, reset perezoso); `#portal ranking` lo muestra.
  Se registra al retirarse y al morir.
- El hook está en `formatearCombate` (`portalPostCombate`): victoria suma
  piso y botín, derrota cobra el 50%, huida/limite cierran; si un combate
  expira sin resultado, el piso se re-sortea con `#avanzar`.

## Arcos narrativos (FASE 8)

- **`data/arcs.js`**: 4 arcos × 8 capítulos, todo en DATA:
  1. *Aldea Sakura Rota* — tutorial y primer encuentro con el rival.
  2. *Torneo de las Cuatro Lunas* — eliminatorias PvE contra rivales y combate final.
  3. *Cumbres del Trueno* — dragones, samuráis y tormentas.
  4. *Abismo Eclipse* — el vacío y los demonios que lo habitan.
- **Cada capítulo** tiene 3 a 5 líneas de diálogo, un combate o una prueba,
  una recompensa (oro/EXP/objeto/título) y termina con
  "Próximo episodio: (título)". Los capítulos tienen requisitos de nivel y
  se desbloquean secuencialmente; al completar un arco se desbloquea el
  siguiente.
- **`#arco`**: muestra el arco y capítulo actual con su diálogo.
- **`#arco avanzar`**: comienza el capítulo actual. Si es combate, inicia el
  motor (`#atk`/`#hab`/`#def`) y, al vencer, cierra el capítulo (recompensa +
  "Próximo episodio"). Si es prueba, la resuelve al instante (stat o azar).
- **`#arco listar`**: muestra progreso de los 4 arcos (completado / actual /
  bloqueado).
- El estado vive en `u.rpg.arco = { id, capitulo }` (persistido; sin
  `globalThis`). El hook `arcoPostCombate` en `formatearCombate` cierra el
  capítulo tras una victoria en combate de arco.

## Equipo, loot y forja (FASE 9)

- **`data/items.js`**: `RAREZAS` (Comun, Raro, Epico, Legendario, Mitico con
  multiplicador de stats y nº de afijos), `FAMILIAS_ARMA` (Katana/Kensei,
  Tomo de Sellos/Onmyōji, Arco Yumi/Hayate, Kodachi/Shinobi, Talismán/
  Shikigami, Campana Fúnebre/Médium Yūrei), `EQUIPO_BASE` (stats base por
  slot y rareza), `MATERIALES` (fragmento/esencia de mineral, pesca común/
  dorada), `MATERIAL_COSTO_MEJORA`, `AFIJOS` (crítico, velocidad, roboVida,
  ki), `AFIJOS_POR_RAREZA`, `SETS` (bono de 3 piezas), `PIEZA_SET`,
  `DURABILIDAD` (gasto por combate y reparación con oro).
- **`core/equipo.js`**: `equipoDe` (estado perezoso en `u.rpg.equipo`,
  migración de armas legacy), `equipar`/`desequipar`, `bonosEquipo` (stats +
  afijos + sets + mejoras, inyectado en `getStats`), `forjar` (oro + materiales),
  `mejorar` (+1 a +10 con riesgo creciente), `reparar` (durabilidad),
  `gastarDurabilidad` (post-combate), `listarEquipo`, `CATALOGO`,
  `obtenerItem`, `crearItem`.
- **`#equipo`**: ver equipo equipado e inventario. **`#equipo equipar <slot>
  <clave>`** / **`#equipo desequipar <slot>`**. **`#forjar <slot> <clave>`**
  (costo en oro y materiales). **`#mejorar <slot>`** (mejora +1, riesgo de
  fallo y pérdida de materiales). **`#reparar`** (restaura durabilidad por oro).
  **`#materiales`**: ver materiales de forja (se obtienen con #minar y #pescar).
- **Migración**: armas v1 (`r.arma`/`r.armas`) se convierten perezosamente a
  items FASE 9 con su rareza (`ARMAS_RAREZA` en `data/migrations.js`) al
  acceder por primera vez. `#armas` y `#herrero` quedan como aliases de
  `#equipo` y `#forjar`.
- **Durabilidad**: opcional (`DURABILIDAD.activada`). Cada combate gasta 1
  punto; al llegar a 0 el item sigue equipado pero sin bonos hasta reparar.

## Cómo probar

```bash
node --check index.js && node --check lib/rpg.js
npm test                              # 33+27+13+28+30+32+19+23 = 224 comprobaciones (FASE 2-9)
node tools/examen-sim.js 30           # balance de exámenes por clase/rango
node tools/cli.js stats kensei
node tools/cli.js enemies
node tools/cli.js lock usuario1        # debe imprimir "correcto (serializado): true"
npm run sim                            # 100 combates: kensei vs jabali
npm run sim -- --all 200               # matriz completa
```

En WhatsApp: `#clase kensei` (o `#clase guerrero`, acepta alias) → `#estado`
(barras HP/Ki, VEL, puntos, zona, medidor de Despertar) → `#entrenar atk 3` →
`#viajar` (lista zonas) → `#cazar` + `#atk`/`#hab 1`/`#def` para subir →
`#cazar jefe` para el jefe de zona → `#portal E` (gasta 1 llave) →
`#avanzar` (pisos: combate/evento/tesoro/santuario) → `#retirarse` (conserva
el botín) → `#portal ranking` → `#arco` (ver capítulo actual) →
`#arco avanzar` (jugar el capítulo) → `#minar` / `#pescar` (materiales) →
`#forjar arma arma_katana_Raro` → `#equipo` → `#mejorar arma` → `#reparar`
→ `#examen` en nivel 10 → `#evolucionar` en nivel 15 → `#evolucionar mayor`
en 35 → `#descansar`.

## Pendiente de fases posteriores

- **FASE 10:** `heredaPct` de shikigami. **FASE 11:** dominio de armas.
- **FASE 12:** economía y anti-abuso. **FASE 13:** comandos y compatibilidad
  (aliases). Etc.
