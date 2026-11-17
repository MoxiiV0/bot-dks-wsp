# Arquitectura del RPG (rework anime)

Estado: **FASE 1 — Arquitectura modular**. Este documento describe la estructura nueva;
las fases siguientes (2-16) irán rellenando los placeholders señalados.

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
  core/                 ← lógica en funciones puras cuando sea posible
    narrate.js          ← rand, pick, money, classLabel, weaponLabel, barra (formato WhatsApp)
    migrate.js          ← ensureRPG (esquema v1, idempotente), migrate (FASE 2: v1→v2 dry-run)
    stats.js            ← getStats, hpMaxDe, getStatsCompletos, gremio/casa
    progression.js      ← addExp, títulos, evolución, habilidades por nivel, misiones
    effects.js          ← useSkill, combinarSkills
    ai.js               ← ataqueEnemigo (FASE 5: arquetipos + fases de jefe)
    combat.js           ← startCombat, combatTurn (HP real, timeouts, skills, derrota/victoria)
    loot.js             ← openChest, generarEventoMazmorra
    lock.js             ← withLock/isLocked: un lock por jugador
tools/
  simulate.js           ← npm run sim — winrate/turnos por clase vs enemigo
  cli.js                ← npm run cli — inspección de datos y prueba del lock
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
node tools/cli.js stats mago
node tools/cli.js enemies
node tools/cli.js lock usuario1        # debe imprimir "correcto (serializado): true"
npm run sim                            # 100 combates: guerrero vs jabali
npm run sim -- --all 200               # matriz completa
```

## Pendiente de fases posteriores

- **FASE 2:** esquema `u.rpg` v2 + `migrate.js` real (dry-run + log).
- **FASE 3:** curva `ceil(40*L^1.65)`, nivel máx 60, stats escalan con nivel.
- **FASE 5:** IA con arquetipos/fases, estados (`statuses.js`), combate unificado.
- **FASE 7:** portales reemplazan mazmorra (sacar `globalThis._mazmorra`).
- **FASE 8:** `arcs.js` real.
