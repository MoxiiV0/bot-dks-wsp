# Auditoría RPG — v3 (pre-rework mazmorras)

Fecha: 2026-11-17 · Rama base: `rework-anime` · Respaldo: `backup_pre_v3/`

## 1. Estado actual (revisado)

El rework de las fases 1-16 ya está completo y pusheado en `rework-anime`. El estado relevante para esta segunda ronda:

### Archivos de núcleo
- `lib/rpg.js` — fachada legacy que re-exporta `./rpg/index.js`.
- `lib/rpg/index.js` — compone data/ + core/ y expone la API completa.
- `lib/rpg/data/` — TODO el contenido es DATA (cero números mágicos en la lógica):
  - `classes.js` — 4 clases base + 2 secundarias + 12 ramas de evolución + DESPERTAR_MAYOR + pasivas + crecimiento.
  - `skills.js` — SKILLS_V2, KITS_POR_CLASE, SKILLS_ALIAS, SKILLS legacy, COMBINACIONES_SKILLS, HABILIDADES_POR_NIVEL, HABILIDADES_ESPECIALES.
  - `enemies.js` — ENEMIES, BOSSSES.
  - `zones.js` — EVENTOS_MAZMORRA, MISSIONS, GUILD_RANKS.
  - `items.js` — WEAPONS, HOUSES, CHESTS, OBJETOS_COMBATE, WEAPON_CLASSES, MANA, ENTRENAMIENTO, DESCANSO, REGEN + FASE 9 (RAREZAS, FAMILIAS_ARMA, EQUIPO_BASE, MATERIALES, MATERIAL_COSTO_MEJORA, AFIJOS, AFIJOS_POR_RAREZA, SETS, PIEZA_SET, DURABILIDAD).
  - `ranks.js` — RANGOS, EXAMENES.
  - `battle.js` — BATALLA (fórmula, crítico, defensa, telegrafía, Despertar, derrota, huida, límite 25), ELEMENTOS, ARQUETIPOS.
  - `world.js` — ZONAS (6 zonas, 42 enemigos), ZONA_INICIAL, ESCALADO.
  - `portals.js` — PORTAL (pisos 55/25/10/10, llaves 3/día, jefe cada 10, muerte −50%) + EVENTOS_PORTAL (5 eventos).
  - `arcs.js` — ARCS (4 arcos × 8 capítulos).
  - `titles.js` — TITLES.
  - `statuses.js` — STATUSES (8 estados).
  - `migrations.js` — CLASS_MAP, ARMAS_RAREZA.
  - `duels.js` (FASE 11) — DUELO, TORNEO, JEFEMUNDIAL.
  - `economía.js` (FASE 12) — EXP_DIARIA, AUDIT_UMBRAL, SUMIDEROS.
- `lib/rpg/core/` — lógica en funciones puras:
  - `narrate.js`, `curve.js`, `migrate.js`, `stats.js`, `progression.js`, `ranks.js`, `effects.js`, `equipo.js`, `companions.js`, `ai.js`, `combat.js`, `loot.js`, `world.js`, `portal.js`, `arcs.js`, `lock.js`, `duels.js`, `economía.js`, `narrativa.js`.

### Comandos RPG en index.js (actuales)
`#clase`, `#armas`, `#herrero`, `#pescar`, `#minar`, `#gremio`, `#rango`, `#npc`, `#nombre`, `#casa`, `#contratar`, `#aprendiz`, `#misiones`, `#mision`, `#combate`, `#cazar`, `#viajar`, `#atk`, `#hab`, `#def`, `#obj`, `#huir`, `#despertar`, `#pelear`, `#pelear-boss`, `#estado`, `#dungeon-start`, `#cofre`, `#bosses`, `#skill`, `#combinar`, `#stats`, `#evolucionar`, `#habilidades`, `#desbloquear`, `#domar`, `#bestias`, `#especial`, `#invocar`, `#usar-especial`, `#activar-mazmorra`, `#titulos`, `#equipar-titulo`, `#mis-titulos`, `#entrenar`, `#reiniciar`, `#descansar`, `#examen`, `#arco`, `#equipo`, `#forjar`, `#mejorar`, `#reparar`, `#materiales`, `#espiritu`, `#duelo`, `#torneo`, `#jefemundial`.

### Fallos conocidos (heredados, a corregir en Fase A)

1. **`#dungeon-start`** — entrega la espada de hierro a `u.rpg.armas` (legacy) y solo la equipa si `rpg.arma === 'nada'`; con el sistema nuevo de equipo el valor real es `null`, así que nunca se equipa realmente y no pasa por `rpg.equipar` (sin rareza, sin afijos, sin integración con el sistema FASE 9).
2. **`#cazar` y portales no exigen clase** — sin clase las stats base son 0 (ki 100, vel 5, sin crecimiento), lo que hace que cualquier combate sea inviable o absurdo.
3. **`npm test` no corre `tools/smoke-fase11.js`** — el test de FASE 11 (duelos/torneo/jefe mundial) existe pero no está en el script de test.
4. **`.gitignore` no cubre** `baileys_auth_bak_*/`, `qr.png`, `qr-data.txt`.
5. **`config.js` tiene `ownerNumber` y `mainGroupLink` hardcodeados** — deben pasar a variables de entorno con valor vacío por defecto.

### Estructura `u.rpg` actual (v2 + extensiones FASES 9-12)
`{ v, clase, evolucion, nivel, exp, hp, ki, kiMax, despertar, puntos, puntosOtorgados, atributos{atk,def,hp,ki,vel}, equipo{arma,armadura,accesorio,reliquia}, inventario{id:cant}, habilidades{id:nivel}, cooldowns{}, estados[], combate, portal{...}, compañeros[], vinculos{}, rival{}, arco{id,capitulo}, rango, titulos[], tituloEquipado, stats{kills,pisos,muertes,duelos}, ultimaRegen, inconscienteHasta, portalLraves{fecha,gastadas}, materiales{id:cant}, mejorasDiarias, ... }`

---

## 2. Decisiones de diseño (Fase A)

- **Clases base (5 desde nivel 1):** Espadachín (Kensei), Ladrón (Shinobi), Invocador (Shikigami/Médium unificado), Mago (Onmyōji), Arquero (Hayate). Cada una con dos ramas: subclase nv15 y clase avanzada nv35.
- **Migración SCHEMA_VERSION 3:** las clases viejas (`kensei`, `shinobi`, `onmyoji`, `hayate`, `shikigami`, `medium_yurei`) se mapean a las nuevas 5 clases base. Las evoluciones viejas se mapean a subclase. Si el jugador es nv35+, va directo a clase avanzada de su rama; si es nv15+ sin evolucionar, elige rama en su próximo comando RPG.
- **Mazmorras nuevas (`lib/rpg/core/mazmorra.js` + `lib/rpg/data/mazmorras.js`):** entrada gratis (sin llaves, sin oro, sin altar del sacrificio), bloques de 10 pisos con jefe en 10/20/30, séquito antes del jefe, 80% combates / 20% eventos, 15% élites, checkpoints, muerte sin perder EXP (solo 50% oro/materiales del bloque actual), retirada siempre conserva todo, expiración 1h conservando botín, escalado `nivelBase + floor((piso-1)*0.6)` + +2% compuesto por piso, jefe HP×6/ATK×1.5 fases 70/40/15, modo infinito +10% por vuelta.
- **Jefes y séquitos (data/mazmorras.js):** 6 mazmorras × 3 jefes, séquito de 5 normales + 1 élite, mecánica única, frases propias, drops y título de primera vez.
- **Eventos (20% de pisos normales):** todos dan algo, ninguno quita oro ni apuesta. Tesoro, Santuario, Mercader Errante (venta a precio fijo y visible), Sanadora del Camino (cura 40% HP gratis), Ermitaño Instructor (+10% ATK 3 combates), Cofre con Trampa (prueba de VEL: gana o pierde 8% HP, nunca oro).
- **EXP:** `ceil(expToNext(nivelEnemigo)/(10+0.25*nivelEnemigo))`, élite ×1.5, jefe ×5, ajuste por diferencia de nivel (±), nunca menos de 10% de base.
- **Drops:** tabla de drops por monstruo con pity a 15 sin material raro; jefe suelta material de su familia + pieza de equipo de su set; primera vez da título + bono EXP único.
- **#bestiario:** monstruos vistos/vencidos, drops descubiertos, debilidades. Completar mazmorra da título + bono permanente pequeño.
- **Misiones diarias (3):** matar 10 monstruos, superar 15 pisos, derrotar jefe; EXP y oro fijos.
- **Fatiga diaria:** después de 60 pisos de combate, EXP al 50% hasta medianoche.
- **#barrer <piso>:** repite pisos superados en un mensaje, simulación que gasta HP/Ki proporcionales, 40% EXP.
- **Modificadores semanales visibles** (no aleatorios por jugador).
- **Ranking semanal por grupo** de piso máximo y jefes vencidos.

---

## 3. Plan de trabajo (fases A–K)

| Fase | Contenido |
|------|-----------|
| **A** | Respaldo, rama `rework-v3`, correcciones previas (dungeon-start, clase obligatoria en cazar/mazmorra, npm test completo, .gitignore, config.js→env), docs/AUDITORIA_V3.md. |
| **B** | Clases base (5), subclases (nv15), clases avanzadas (nv35), árbol en data/classes.js, skills de cada rama, migración SCHEMA 3, comandos `#ramas` y `#ascender`. |
| **C** | Mazmorras nuevas: core/mazmorra.js + data/mazmorras.js, entrada gratis, bloques de 10, jefe cada 10, séquito, checkpoints, muerte sin drama, retirada siempre conserva, escalado, rangos, resumen al salir. |
| **D** | 6 mazmorras × 3 jefes con séquitos (5 normales + 1 élite), mecánicas únicas, frases, drops, título primera vez (~108 monstruos con plantillas). |
| **E** | Eventos de mazmorra (20% de pisos): tesoro, santuario, mercader, sanadora, ermitaño, cofre con trampa. Sin riesgo de oro. |
| **F** | EXP por monstruo, ajuste por diferencia de nivel, curación y puntos por subida, barra de EXP, #ficha con hitos. |
| **G** | Drops por monstruo, pity a 15, jefe suelta material+equipo de set, título+bono EXP primera vez, #bestiario, misiones diarias (3). |
| **H** | Fatiga diaria (60 pisos), #barrer, modificadores semanales visibles, #auto para monstruos débiles, ranking semanal por grupo. |
| **I** | Comandos: #mazmorra, #mazmorra <id>, #mazmorra continuar, #avanzar, #retirarse, #barrer, #bestiario, #diarias, #comprar, #clase, #ramas, #ascender, aliases #portal/#mazmorra-boss. Actualizar #help y helpCategories, quitar menciones a llaves/pago entrada. |
| **J** | Extender tools/simulate.js para mazmorras completas (clase, rama, nivel, mazmorra, bloques), objetivos de balance. |
| **K** | Smoke tests nuevos, npm test completo, docs/RPG.md actualizado, README cómo agregar mazmorra/jefe, checklist QA manual. |

---

## 4. Reglas inamovibles (reafirmadas)

1. Backup `backup_pre_v3/` + rama `rework-v3` antes de tocar nada (hecho en esta fase).
2. Un commit por fase.
3. Comandos viejos quedan como alias (tabla Fase I).
4. Todo el contenido es DATA en archivos separados. Cero números mágicos en lógica.
5. Nada de estado en `globalThis`. Todo en `u.rpg`, persistido con `markEconDirty()`, lock por jugador.
6. Cero IP de terceros. Nombres, técnicas y personajes originales.
7. Nada de mecánicas de apuesta: sin pagar por entrar, sin doble o nada, sin perder oro al azar. Premios visibles y predecibles.
8. Español neutro, <1500 chars, formato WhatsApp. Un mensaje por piso y uno por turno de combate.
9. Nunca leer, copiar ni exponer carpetas `baileys_auth*`.

**Estado de la Fase A:** pendiente escritura de `docs/AUDITORIA_V3.md` y correcciones (1)-(5). Listo para continuar con las correcciones una vez el usuario dé "continuar".
