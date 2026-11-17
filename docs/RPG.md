# Arquitectura del RPG (rework anime)

Estado: **FASE 1 (arquitectura) + FASE 2 (esquema v2 y migración) completas**.
Las fases siguientes (3-16) irán rellenando los placeholders señalados.

## Estructura

```
lib/rpg.js              ← fachada legacy: SOLO re-exporta ./rpg/index.js (no tocar lógica acá)
lib/rpg/
  index.js              ← compone data/ + core/ y expone la API completa
  data/                 ← TODO el contenido es DATA (cero números mágicos en la lógica)
    classes.js          ← CLASSES, NUEVAS_CLASES, EVOLUCIONES_CLASE, getClass, baseClassKey
    skills.js           ← SKILLS, COMBINACIONES_SKILLS, HABILIDADES_POR_NIVEL, HABILIDADES_ESPECIALES
    enemies.js          ← ENEMIES, BOSSSES
    zones.js            ← EVENTOS_MAZMORRA, MISSIONS, GUILD_RANKS
    items.js            ← WEAPONS, HOUSES, CHESTS, WEAPON_CLASSES, ENTRENAMIENTO, MANA
    arcs.js             ← ARCS (FASE 8, placeholder)
    titles.js           ← TITLES (condición + bonus)
    statuses.js         ← STATUSES (FASE 5, placeholder)
    migrations.js       ← CLASS_MAP (FASE 4), ARMAS_RAREZA (FASE 9) — puro DATA
  core/                 ← lógica en funciones puras cuando sea posible
    narrate.js          ← rand, pick, money, classLabel, weaponLabel, barra (formato WhatsApp)
    curve.js            ← expToNext(L)=ceil(40*L^1.65), MAX_LEVEL=60 (FASE 3 la amplía)
    migrate.js          ← ensureRPG (v1+proyecciones), migración v1→v2 perezosa, dry-run, log
    stats.js            ← getStats, hpMaxDe, getStatsCompletos, gremio/casa, hp/ki actual
    progression.js      ← addExp (curva nueva), títulos, evolución, habilidades, misiones
    effects.js          ← useSkill, combinarSkills
    ai.js               ← ataqueEnemigo (FASE 5: arquetipos + fases de jefe)
    combat.js           ← startCombat, combatTurn (HP real, timeouts, skills, tipo de resultado)
    loot.js             ← openChest, generarEventoMazmorra
    lock.js             ← withLock/isLocked: un lock por jugador
tools/
  simulate.js           ← npm run sim — winrate/turnos por clase vs enemigo
  cli.js                ← npm run cli — inspección de datos y prueba del lock
  smoke-fase2.js        ← npm test — 32 comprobaciones de esquema/migración
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
  puntos (sin gastar), atributos {atk,def,hp,ki,vel},
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
- **Renombrado FASE 4/9:** `CLASS_MAP`/`ARMAS_RAREZA` en `data/migrations.js`
  se aplican de forma perezosa y **solo si el destino ya existe en data/** —
  hoy es no-op y se activará solo cuando FASE 4 agregue `kensei`, `onmyoji`, etc.

## API principal (fachada `require('./lib/rpg')`)

| Área | Funciones |
|------|-----------|
| Estado | `ensureRPG(u)`, `migrate(u, {dryRun})` |
| Stats | `getStats(u)`, `hpMaxDe(u)`, `getStatsCompletos(u)` |
| Progresión | `addExp(u, n)`, `checkTitles(u)`, `unlockTitle(u, key)`, `evolucionarClase(u, key)` |
| Combate | `startCombat(u, enemyKey)`, `combatTurn(u, action)` → `{resultado, terminado, tipo}` |
| Efectos | `useSkill(u, key)`, `combinarSkills(u, k1, k2)` |
| Botín | `openChest(u, key)`, `generarEventoMazmorra(obj)` |
| Lock | `withLock(id, fn)`, `isLocked(id)` |
| Datos | `CLASSES`, `ENEMIES`, `SKILLS`, `TITLES`, `WEAPONS`, ... (ver `lib/rpg/index.js`) |

`combatTurn` devuelve `tipo`: `'victoria' | 'derrota' | 'escape' | 'limite' | null`.

## Curvas y constantes de combate (FASE 1)

Viven como constantes nombradas en `core/combat.js`:

- `COMBATE_TIMEOUT_MS` = 10 min de inactividad
- `COMBATE_MAX_TURNOS` = 15
- `DERROTA_PIERDE_PCT` = 10% del cash en mano
- `DERROTA_HP_RESTANTE_PCT` = 30% de HP al escapar derrotado
- `DOMA_BESTIA_PROB` = 20% (invocador)

La curva de EXP actual es `expSiguiente = nivel * 100` (legado). La FASE 3 la
cambia a `ceil(40 * nivel^1.65)` con máximo nivel 60.

## Cómo probar

```bash
node --check index.js && node --check lib/rpg.js
npm test                              # 32 comprobaciones de esquema v2 + migración
node tools/cli.js stats mago
node tools/cli.js enemies
node tools/cli.js lock usuario1        # debe imprimir "correcto (serializado): true"
npm run sim                            # 100 combates: guerrero vs jabali
npm run sim -- --all 200               # matriz completa
```

En WhatsApp: `#clase guerrero` → `#estado` debe mostrar EXP/nivel 40 (curva nueva).

## Pendiente de fases posteriores

- **FASE 3:** stats escalan con nivel (crecimiento por clase), puntos de atributo
  con `#entrenar`, rangos E..S con examen, regeneración por tiempo (`ultimaRegen`),
  `#descansar`. El tope 60 y la curva ya están (`curve.js`).
- **FASE 5:** IA con arquetipos/fases, estados (`statuses.js`), combate unificado,
  Despertar, `inconscienteHasta`.
- **FASE 7:** portales reemplazan mazmorra (sacar `globalThis._mazmorra`).
- **FASE 8:** `arcs.js` real. **FASE 9:** equipo real (rarezas con ARMAS_RAREZA).
