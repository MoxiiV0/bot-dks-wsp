# Auditoría RPG — bot-dks-wsp (pre-rework)

Fecha: 2026-11-17 · Rama base: `main` @ `4b5bd19` · Respaldo: `backup/_pre_rework/`

## 1. Inventario de comandos RPG (index.js)

Líneas según `index.js` (3398 líneas totales).

| Comando | Línea | Estado / notas |
| --- | --- | --- |
| `#mazmorra <apuesta>` | 1538 | Gate `mazmorraActiva` por chat. Estado en `globalThis._mazmorra`. Apuesta retenida. |
| `#avanzar` | 1578 | Usa `rpg.generarEventoMazmorra(u)` (modifica `u.cash` directo, NO el pool de la sesión). |
| `#retirarse` | 1606 | Paga `session.ganado` (que solo crece en la entrada, ver §4). |
| `#mazmorra-boss` (hardcoded) | 1623 | **CÓDIGO MUERTO**: clave duplicada, sobreescrita por la de la línea 1766. |
| `#pelear-boss` (1ª copia) | 1659 | **CÓDIGO MUERTO**: sobreescrita por la de la línea 1805. |
| `#cofre <tipo>` | 1724 | `rpg.openChest` — sumidero de oro con prob. de trampa. |
| `#bosses` | 1751 | Lista `rpg.BOSSSES`. |
| `#mazmorra-boss <clave>` | 1766 | Activa (gana la clave duplicada). Estado en `globalThis._mazmorraBoss`. |
| `#pelear-boss` | 1805 | Activa. Combate inline, sin HP real del jugador. |
| `#skill <nombre>` | 1866 | Cobra `u.cash` (¡oro, no maná!) y NO tiene efecto en combate: es texto pagado. |
| `#combinar <s1> <s2>` | 1926 | `rpg.combinarSkills`, cobra oro. |
| `#stats` | 1959 | `rpg.getStats` (con bonus de título). |
| `#evolucionar <clase>` | 1989 | `rpg.evolucionarClase` (nivel 15, 4 líneas base → 4 evoluciones). |
| `#habilidades` | 2012 | Disponibles por nivel (`HABILIDADES_POR_NIVEL`). |
| `#desbloquear <key>` | 2033 | Desbloquea skill por nivel. |
| `#domar <bestia>` | 2052 | Solo invocador. |
| `#bestias` | 2089 | Lista bestias domadas. |
| `#especial` | 2109 | Habilidad especial cada 10 niveles. |
| `#titulos` | 2131 | `rpg.checkTitles` + lista. |
| `#equipar-titulo <nombre>` | 2157 | `rpg.unlockTitle`. |
| `#mis-titulos` | 2189 | Lista propia. |
| `#activar-mazmorra on/off` | 2213 | Gate por chat, solo admins. |
| `#invocar <bestia>` | 2240 | Invocación con daño inline. |
| `#usar-especial <key>` | 2292 | Cobra oro, efectos inline. |
| `#clase <nombre>` | 2330 | Solo acepta las 4 clases base (`rpg.CLASSES`); evoluciones solo vía `#evolucionar`. |
| `#armas` | 2350 | Lista `u.rpg.armas`. |
| `#herrero forjar\|mejorar` | 2362 | Forja de `rpg.WEAPONS`. |
| `#pescar` | 2406 | Cooldown con `rpgLeft` (3 min). |
| `#minar` | 2434 | Cooldown `rpgLeft` (4 min). |
| `#gremio crear\|unirse\|ver` | 2464 | Gremios en `settings.guilds`. |
| `#rango` | 2522 | Rango por oro acumulado del gremio. |
| `#npc <tipo>` | 2536 | Diálogo estático. |
| `#nombre <texto>` | 2549 | Nombre personalizado. |
| `#casa <tipo>` | 2565 | `rpg.HOUSES`, bonus en `getStats`. |
| `#contratar` / `#aprendiz` | 2584 / 2601 | Aventureros NPC. |
| `#misiones` / `#mision <key>` | 2617 / 2639 | `MISSIONS` (solo 4, sin progreso real observable). |
| `#combate <enemigo>` | 2655 | `rpg.startCombat` (motor 1). |
| `#pelear` | 2673 | `rpg.combatTurn` (motor 1). |
| `#estado` | 2690 | Texto manual, duplica a `#stats` con fórmula propia (`nivel*100`). |
| `#dungeon-start` | 2705 | Tutorial: 2000 Coins + espada de hierro. |

Comandos planificados que **NO existen** (solo constantes en `lib/rpg.js`):
`#entrenar` (ENTRENAMIENTO), `#leer` (MANA). `mana`/`manaMax`/`entrenamiento` se crean en `ensureRPG` pero nadie los usa.

## 2. Estructura actual de `u.rpg`

Definida por `ensureRPG` (lib/rpg.js:256) + campos ad-hoc:

```
clase (string|null)        arma / armas[]                 nivel (num)     exp (num)
oro (num)                  pescado / minerales (num)      nombrePersonalizado
casa (key|null)            aventureros[]                  aprendiz
misiones{}                 misionesCompletadas[]          combate (null|{enemyKey,enemyHp,enemyMaxHp,turnos})
entrenamiento{atk,def,hp}  mana / manaMax (sin uso)       statsTrabajos / statsCrimenes / maxBank
statsEnemigosDerrotados    statsPisos                     titulosDesbloqueados[]   tituloEquipado
```

Campos ad-hoc fuera de `ensureRPG` (pueden no existir → riesgo de `undefined`):
`gremio`, `skillsCombinadas[]`, `habilidadesDesbloqueadas[]`, `bestiasDomadas[]`, `bestiasActivas[]`,
`claseEvolucionada` (bool), `tutorialCompletado` (bool), `cd{}` (cooldowns RPG vía `rpgLeft`), `dailyStreak` (fuera de rpg).

**No hay**: HP/Ki real, puntos de atributo, inventario, equipo (slots), estados de combate, portal, rival, arcos, compañeros, versión de esquema (`v`).

## 3. Código duplicado

1. **Bucle de subir de nivel** (`while (exp >= nivel*100) { exp -= nivel*100; nivel += 1 }`) — **5 copias**:
   - `lib/rpg.js:318` (completeMission), `lib/rpg.js:360` (combatTurn), `lib/rpg.js:473` (generarEventoMazmorra)
   - `index.js:1687` (pelear-boss muerta), `index.js:1832` (pelear-boss activa)
   - Curva plana `exp = nivel * 100` (la Fase 3 la reemplaza por `ceil(40 * L^1.65)`).
2. **Motor de combate duplicado**: `rpg.combatTurn` (motor 1, #pelear) vs combate inline de jefe en `index.js` (#pelear-boss ×2 copias casi idénticas).
3. **Dos funciones distintas llamadas `generarEventoMazmorra`**:
   - `index.js:531` (local, recibe `session`, suma a `session.ganado`) — usada por `#mazmorra` (línea 1573).
   - `lib/rpg.js:445` (recibe `u`, modifica `u.cash`) — usada por `#avanzar` (línea 1588).
4. **Claves duplicadas en `commands`**: `mazmorra-boss` (1623 vs 1766) y `pelear-boss` (1659 vs 1805). Gana la última; las primeras son código muerto.
5. **`#stats` vs `#estado`**: dos formas de mostrar estadísticas con fórmulas distintas.
6. **Textos de combate reconstruidos a mano** en cada comando (sin plantilla compartida).

## 4. Bugs / problemas detectados (hallazgos de la auditoría)

1. **`#avanzar` rompe la custodia de la apuesta**: `rpg.generarEventoMazmorra(u)` modifica `u.cash` directamente; `session.ganado` solo crece en la entrada (`index.js:531`). Resultado: el botín de `#retirarse` no refleja lo ganado al avanzar y los eventos tocan el cash global (compartido con el casino).
2. **Estado en `globalThis`** (`_mazmorra`, `_mazmorraBoss`): se pierde al reiniciar el bot. Un jugador puede quedar "fantasma" (la sesión no está en ningún lado pero tampoco puede reclamar).
3. **HP del jugador es inventado**: `combatTurn` muestra "vitalidad estimada = 100 - turnos*dmg"; `#pelear-boss` no lleva HP del jugador en absoluto. Las clases con más HP no tienen ventaja real.
4. **`#skill` cobra oro y no hace nada en combate** (solo imprime efectos). Las skills no están conectadas al motor de combate.
5. **Contadores de títulos nunca incrementados**: `statsCrimenes`, `statsEnemigosDerrotados`, `statsPisos`, `maxBank` no se tocan en ningún lado (grep = 0 resultados). Solo `statsTrabajos` (work) y `señor_oro` (lee `u.cash`) pueden desbloquearse. → 4 de 6 títulos inalcanzables.
6. **Sin lock por jugador**: dos `#pelear` seguidos corren `combatTurn` dos veces sin control (interleaving de mensajes async).
7. **Nivel no escala stats**: `combatTurn` usa `clase.atkBase + arma.atk` fijo; subir de nivel no aumenta daño ni defensa.
8. **Sin cooldown de combate ni expiración**: `combatTurn` corta a los 10 turnos por texto, pero el estado quedaba si el mensaje no llegaba; no hay timestamp de expiración.
9. **`#clase` no permite elegir invocador/nigromante** (no están en `CLASSES`), aunque `#skill`/`#domar` los referencian → inaccesibles salvo por migración futura.
10. **`#mazmorra` es solo azar con apuesta** (55% gana plata, 18% neutral, 13% trampa, 14% final): no hay combate, ni HP, ni dificultad por piso.

## 5. Funciones reutilizables (existentes, conservar)

**lib/rpg.js**: `ensureRPG`, `getStats`, `getStatsCompletos`, `checkTitles`, `unlockTitle`, `rand`, `money`, `classLabel`, `weaponLabel`, `getGuildRank`, `getHouseBenefit`, `getAvailableMissions`, `startMission`, `completeMission`, `startCombat`, `combatTurn`, `openChest`, `useSkill`, `generarEventoMazmorra` (la de u), `combinarSkills`, `evolucionarClase`, `obtenerHabilidadesNivel`, `desbloquearHabilidadPorNivel`, `obtenerHabilidadEspecial`, `ensureGuild`.

**index.js (helpers de economía/persistencia)**: `econUser(id)`, `markEconDirty()`, `saveEcon()`, `writeAuditLog(...)`, `rpgLeft(u, cmd, ms)`, `cdLeft`/`cdSet`, `getSenderId(ctx)`, `pick(arr)`.

**Datos actuales (pasar a `lib/rpg/data/`)**: CLASSES (4+6), WEAPONS (13), GUILD_RANKS (5), HOUSES (5), MISSIONS (4), ENEMIES (5), BOSSSES (6), CHESTS (4), WEAPON_CLASSES (4), SKILLS (4 clases × 2), EVENTOS_MAZMORRA (5), COMBINACIONES_SKILLS (4), EVOLUCIONES_CLASE (4), NUEVAS_CLASES (6), HABILIDADES_POR_NIVEL (10 clases), HABILIDADES_ESPECIALES (4), ENTRENAMIENTO (3), MANA, TITLES (6).

## 6. Puntos de integración con el rework

- **No romper**: `u.cash` (casino: blackjack, ruleta, tragamonedas, rob, pay, work, daily), `markEconDirty`/escritura atómica, gates `OWNER_ONLY`/`HARD_RESTRICTED`, `#activar-mazmorra`, `helpCategories.rpg`, `publicCommands`, `rpgLeft`.
- **Migración v1→v2** debe leer exactamente los campos de §2 y los ad-hoc (§2 final).
- **Alias de comandos viejos** (Fase 13): mapear sobre las líneas de §1.
- **Comandos con cooldown existente**: `#pescar` (3 min), `#minar` (4 min) → mover a `u.rpg.cooldowns`.
