# Tasks — Escalerilla de Tenis Club La Dehesa

> Backlog de trabajo organizado por **milestones entregables**. Cada milestone deja algo funcionando que se puede mostrar y probar. Las estimaciones son gruesas (orden de magnitud), asumiendo un desarrollador part-time.
>
> Estado general actualizado el **2026-05-26**: MVP operativo en código local, con M8 mayormente integrado (perfil enriquecido, onboarding, ranking/fixture renovados, PWA, emails y disponibilidad preferente). Pendiente principal: verificación final de producción/Playwright, dominio y hardening operativo.

---

## Leyenda

- `[ ]` — pendiente
- `[x]` — completado
- `[~]` — en progreso
- 🔴 crítico · 🟡 importante · 🟢 nice-to-have

---

## Milestone 0 — Setup inicial

**Objetivo**: repo corriendo localmente y desplegado en Vercel con un "hola mundo" autenticado.
**Estimación**: ~1 día.

> Estado actual (2026-05-26): app completa corriendo en local. Falta confirmar deploy production y env vars finales en Vercel.

- [x] 🔴 Inicializar proyecto Next.js con TypeScript + Tailwind
- [x] 🔴 Crear repositorio en GitHub y push inicial
- [ ] 🔴 Linkear proyecto a Vercel (`vercel link`)
- [x] 🔴 Provisionar Neon Postgres (Neon conectado y funcionando)
- [x] 🔴 Configurar Drizzle y primer push de schema
- [x] 🔴 Configurar NextAuth con proveedor Google
- [ ] 🔴 Configurar env vars en Vercel (`vercel env add`) y validar deploy autenticado en producción
- [x] 🔴 Crear layout base con header + navegación + footer
- [x] 🔴 Instalar y configurar shadcn/ui (Button, Input, Table, Card, Dialog)
- [x] 🟡 Configurar lint/format con Biome + tsconfig estricto
- [ ] 🟡 Deploy de preview y production funcionando
- [ ] 🟢 Crear `vercel.ts` con configuración base si se decide usar SDK/CLI programático

**Criterio de aceptación**: entro a la URL de production, hago login con Google, veo mi nombre en el header.

---

## Milestone 1 — Jugadores y ranking base

**Objetivo**: modelo de jugadores cargado y ranking público navegable.
**Estimación**: ~2-3 días.

> Estado actual (2026-05-26): admin de jugadores operativo, perfiles enriquecidos, historial por jugador visible, ranking con desempates y mejor posición histórica. La carga histórica se complementa con scripts de backfill/resultados.

- [x] 🔴 Schema Drizzle: `users`, `players`, `seasons`, `ranking_events`, `audit_log`
- [x] 🔴 Seed de temporada 2026 (`seasons`)
- [x] 🔴 CRUD de jugadores en `/admin/jugadores` (crear, editar, marcar retirado)
- [x] 🔴 Import CSV de ranking inicial (nombre, género, puntos iniciales) → crea jugadores + `ranking_events` con `reason='initial_seed'`
- [x] 🔴 Vista pública `/` con tabs H / M mostrando ranking
- [x] 🔴 Vista `/ranking/[categoria]` con historial de eventos al hacer click en un jugador
- [x] 🔴 Cálculo de puntos vigentes = `sum(ranking_events.delta)`
- [x] 🔴 Desempate RN-11 (H2H, sets, games, sorteo) implementado
- [x] 🟡 Link del jugador al perfil público con sus partidos jugados
- [x] 🟡 Auditoría de alta/edición de jugadores
- [ ] 🟢 Export CSV del ranking actual

**Criterio de aceptación**: cargo el CSV con 30 jugadores, veo el ranking ordenado correcto, los empates se resuelven bien.

---

## Milestone 2 — Disponibilidad semanal

**Objetivo**: los jugadores declaran disponibilidad, el admin la ve consolidada.
**Estimación**: ~1-2 días.

> Estado actual (2026-05-26): completo. Schema `weeks` + `availability`, formulario de jugador y preferencias de disponibilidad general operativos.

- [x] 🔴 Schema Drizzle: `weeks`, `availability`
- [x] 🔴 Vista `/admin/semanas` con lista de semanas y estados
- [x] 🔴 Acción admin: abrir disponibilidad para la próxima semana
- [x] 🔴 Formulario `/disponibilidad` para el jugador (días LUN-DOM + cupo 0/1/2/3)
- [x] 🔴 Upsert (`unique(player_id, week_id)`) — el jugador puede cambiar hasta que cierre la ventana
- [x] 🔴 Vista admin `/admin/semanas/[id]` con tabla consolidada H y M
- [x] 🔴 Acción admin: cerrar disponibilidad
- [x] 🟡 Recordatorio en WhatsApp → botón "copiar mensaje recordatorio" en admin
- [x] 🟡 Contador visible "X de Y jugadores ya declararon"

**Criterio de aceptación**: abro una semana, 5 jugadores declaran desde sus teléfonos, veo la tabla consolidada con sus respuestas.

---

## Milestone 3 — Fixture asistido y publicación

**Objetivo**: propuesta automática de cruces + edición manual + publicación + mensaje para WhatsApp.
**Estimación**: ~2-3 días.

> Estado actual (2026-05-26): completo. Algoritmo greedy operativo, editor interactivo, publicación transaccional, vista pública con WeekStepper, impresión y resaltado de partidos propios.

- [x] 🔴 Schema Drizzle: `matches`, `match_sets`
- [x] 🔴 Algoritmo `lib/fixture/propose.ts`:
  - [x] 🔴 Filtrar jugadores disponibles activos
  - [x] 🔴 Respetar `max_matches` declarado (RN-04, RN-05)
  - [x] 🔴 Bloquear repetición de rival en 30 días (RN-03)
  - [x] 🔴 Minimizar diferencia de ranking
- [x] 🔴 Vista `/admin/semanas/[id]/fixture`:
  - [x] 🔴 Botón "Generar propuesta" (por categoría)
  - [x] 🔴 Edición: mover jugadores, eliminar match, agregar match manual
  - [x] 🔴 Validación en vivo al editar (detecta violaciones de RN-03)
- [x] 🔴 Acción admin: publicar fixture (crea filas en `matches` con `type='sorteo'`, `status='pendiente'`)
- [x] 🔴 Vista pública `/fixture` con fixture vigente
- [x] 🔴 `lib/fixture/message.ts` → string formateado para WhatsApp
- [x] 🔴 Botón "Copiar mensaje" que copia al clipboard
- [x] 🟡 Highlight de mis partidos en `/fixture` si estoy logueado
- [x] 🟡 Auditoría de publicación

**Criterio de aceptación**: con 20 disponibles en H, el admin genera propuesta en <5s, hace 2-3 ajustes, publica, y copia un mensaje limpio para WhatsApp.

---

## Milestone 4 — Resultados y ranking automático

**Objetivo**: el admin registra resultados y el ranking se actualiza solo.
**Estimación**: ~3 días.

> Estado actual (2026-05-26): completo. Registro de resultados MR3 y set largo, W.O., empates, correcciones y flujo `/ingresar-resultado`. Historial de partidos con detalle en `/mi-perfil/partidos/[id]`.

- [x] 🔴 `lib/rules/scoring.ts` que dado `matches` + `match_sets` devuelve los deltas de cada jugador según RN-01 y RN-02
- [x] 🔴 Validaciones de scores tenis (6-0..6-4, 7-5, 7-6, super tie-break)
- [x] 🔴 Vista `/ingresar-resultado` / admin con partidos pendientes, jugados y WO
- [x] 🔴 Form de registro de resultado con formato (mr3 / set_largo) y sets dinámicos
- [x] 🔴 Soporte de empate (status=`empate`) con puntos correctos
- [x] 🔴 Soporte de W.O. (status=`wo`, `wo_loser_id`)
- [x] 🔴 Insert transaccional: `match_sets` + 2 `ranking_events` + `audit_log`
- [x] 🔴 Edición de resultado → anular eventos anteriores con nuevo evento compensatorio + nuevo resultado (nunca borrar)
- [x] 🔴 Contadores en `/mi-perfil`: partidos esta semana / mes, desafíos aceptados mes
- [x] 🟡 Historial visible de mis partidos con links a detalle
- [x] 🟡 Admin puede filtrar partidos por semana / categoría / estado

**Criterio de aceptación**: registro un 6-4 / 3-6 / 10-7 → el ganador suma 60, el perdedor suma 30, el ranking se reordena correctamente.

---

## Milestone 5 — Desafíos, congelaciones, penalizaciones

**Objetivo**: cerrar las reglas del reglamento que quedan.
**Estimación**: ~2 días.

> Estado actual (2026-05-26): funcional. Schema `freezes`, admin congelaciones, admin desafíos, zona desafiable y cron `/api/cron/inactividad` existen. En `vercel.json` hoy solo está programado el recordatorio de disponibilidad; la activación programada de inactividad queda pendiente de decisión operativa.

- [x] 🔴 Schema Drizzle: `freezes`
- [x] 🔴 Vista `/admin/congelaciones`: registrar freeze (validar máx 3/semestre RN-09)
- [x] 🔴 Vista `/mi-perfil` muestra mi "zona desafiable" (±5 en mi categoría) con estado "puedo desafiar" / "jugamos hace X días"
- [x] 🔴 `/admin/desafios`: registrar partido tipo desafío (valida RN-06 y RN-03, permite overrides con justificación)
- [x] 🔴 Cron semanal `/api/cron/inactividad` protegido por `CRON_SECRET`:
  - [x] 🔴 -40 pts a quien no jugó el último mes (RN-10)
  - [x] 🔴 -25% a quien no juega 3 meses, idempotente
  - [x] 🔴 -50% a quien no juega 6 meses, idempotente
  - [x] 🔴 -100% a quien no juega 1 año, idempotente
  - [x] 🔴 Exención para lesionados justificados (RN-10)
- [ ] 🔴 Configurar cron de inactividad en `vercel.json` si el Comité confirma la política de aplicación automática
- [x] 🟡 Contador de desafíos aceptados en el mes en `/mi-perfil`
- [ ] 🟡 Job manual "recalcular inactividad ahora" en admin

**Criterio de aceptación**: creo un freeze para un jugador, deja de aparecer en la próxima propuesta; avanzamos el tiempo y el jugador sin partidos pierde -40 al fin de mes.

---

## Milestone 6 — Campeonatos internos

**Objetivo**: registrar podios y partidos de campeonatos para aplicar los bonus del reglamento.
**Estimación**: ~1 día.

> Estado actual (2026-05-26): completo en código. Schema `championships` + `championship_placements` + enum `championship_type`, `/admin/campeonatos` con formulario de podio y bonus. Verificar migraciones aplicadas en cada ambiente antes de operar production.

- [x] 🔴 Schema Drizzle: `championships`, `championship_placements`
- [x] 🔴 Vista `/admin/campeonatos`: crear campeonato (regular / clausura / especial), registrar podio
- [x] 🔴 Al registrar podio, insertar `ranking_events` con bonus según RN-12
- [x] 🔴 Registrar partidos individuales del campeonato con `type='campeonato'` desde Admin › Partidos (no aplican límites RN-04)
- [x] 🟡 Vista pública del podio en `/ranking/[categoria]` como "hitos de la temporada"

**Criterio de aceptación**: registro "Copa Verano campeón Pedro, finalista Juan" y Pedro suma +150, Juan suma +75. ✅

---

## Milestone 7 — Pulido y entrega

**Objetivo**: dejar la app lista para ser usada por los socios del club.
**Estimación**: ~1-2 días.

> Estado actual (2026-05-26): casi completo. Mobile nav, error pages en español, home, PWA icons/manifest, OpenGraph y tests unitarios de reglas/validaciones. Falta Playwright happy path y verificación production.

- [x] 🔴 Revisión mobile de todas las pantallas (hamburger nav para móvil)
- [x] 🔴 Copy de onboarding en `/login` y en la primera visita
- [x] 🔴 Mensaje "¿Cómo funciona?" en home para jugadores nuevos
- [x] 🔴 Guía para el admin (`docs/ADMIN_GUIDE.md`)
- [x] 🟡 Manejo de errores amable (páginas 404 / 500 en español)
- [x] 🟡 Tests Vitest de reglas críticas y validaciones de perfil
- [ ] 🟡 Test Playwright del happy path completo
- [ ] 🟢 Dominio custom del club (si lo hay)
- [x] 🟢 OpenGraph metadata configurada

---

## Milestone 8 — Perfil enriquecido, identidad ATP y navegación temporal

**Objetivo**: que la app deje de sentirse "MVP funcional" y se convierta en una experiencia tipo mini-ATP. Perfiles ricos accesibles desde modal, onboarding bloqueante con datos personales y deportivos, navegación entre semanas pasadas/futuras del fixture, paleta visual de torneo.
**Estimación**: ~5-7 días.

> **Detalle ejecutable** histórico en [`docs/M8_REDESIGN.md`](./M8_REDESIGN.md). Este resumen refleja el estado actual del código.

- [x] 🔴 Schema extendido de `players` + enums + migraciones aditivas
- [x] 🔴 Validación RUT (módulo 11) y teléfono CL (E.164) con tests
- [x] 🔴 Design system ATP-inspired: componentes `Avatar`, `Badge`, `Tabs`, `Skeleton`, `EmptyState`, `WeekStepper`, `StreakDots`
- [x] 🔴 Onboarding bloqueante con identidad, tenis y disponibilidad general
- [x] 🔴 PlayerCardModal con tabs Info + Rendimiento y link de perfil
- [x] 🔴 Ranking refactor: tabular-nums, top-3 destacado, click → perfil/modal
- [x] 🔴 Fixture con WeekStepper para navegar semanas publicadas
- [x] 🟡 Admin /jugadores: edición de `level` y datos de perfil
- [x] 🟡 Header/mobile nav con paleta actual
- [ ] 🔴 Build, lint, tests verdes y verificación manual mobile 375px

**Criterio de aceptación**: un jugador nuevo entra con Google, completa onboarding obligatorio, ve el ranking con paleta ATP, hace click en cualquier jugador y abre un modal con su info y rendimiento, navega entre semanas pasadas del fixture.

**Decisiones referenciadas**: ADR-027 (paleta), ADR-028 (modal vs página).

---

## Backlog transversal (no bloquea milestones)

- [ ] 🟡 Confirmación de email con código para cuentas creadas con email/password (no Google)
- [ ] 🟢 Dashboard admin con métricas: jugadores activos, partidos de la semana, % participación
- [x] 🟢 Vista imprimible del fixture publicado
- [ ] 🟢 Envío real de email cuando se publica fixture (templates/eventos existen; falta activar proveedor y política)
- [x] 🟢 Estadísticas individuales básicas en perfil público

---

## Riesgos conocidos

- **Regla RN-10 escalonada (PD-01)**: la interpretación requiere confirmación del Comité antes de implementar el cron. Si se interpreta mal, jugadores pueden perder puntos injustamente.
- **Migraciones por ambiente**: varias migraciones/backfills ya existen; antes de production hay que confirmar que Neon production tiene exactamente el schema esperado.
- **Volumen de cambios a mitad de temporada**: si el reglamento cambia durante el año, hay que versionar. No está modelado.
- **Admin único punto de falla**: todo pasa por el admin. Si no registra, nada se mueve. Mitigar con múltiples admins.

---

## Orden sugerido de ejecución

1. M0 (setup) — bloqueante de todo.
2. M1 (jugadores + ranking) — permite empezar a mostrar algo útil al club.
3. M2 (disponibilidad) — cierra la primera mitad del ciclo operativo.
4. M3 (fixture) — cierra el valor principal para el admin.
5. M4 (resultados) — cierra el ciclo completo.
6. M5 (desafíos, congelaciones, inactividad) — reglas complejas que se pueden agregar sin bloquear el uso.
7. M6 (campeonatos) — solo relevante cuando se juegue uno.
8. M7 (pulido) — antes de abrir a los socios.
9. M8 (rediseño + perfil enriquecido) — experiencia tipo torneo profesional, ya integrada en su mayor parte.

Se puede operar el uso real con el estado actual, dejando como cierre recomendado verificación production, Playwright y decisión sobre inactividad automática.
