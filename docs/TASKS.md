# Tasks — Escalerilla de Tenis Club La Dehesa

> Backlog de trabajo organizado por **milestones entregables**. Cada milestone deja algo funcionando que se puede mostrar y probar. Las estimaciones son gruesas (orden de magnitud), asumiendo un desarrollador part-time.

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

> Estado actual (2026-04-27): login Google verificado en local. shadcn/ui instalado. Deploy en Vercel pendiente de configurar env vars en plataforma.

- [x] 🔴 Inicializar proyecto Next.js 15 con TypeScript + Tailwind
- [x] 🔴 Crear repositorio en GitHub y push inicial
- [ ] 🔴 Linkear proyecto a Vercel (`vercel link`)
- [x] 🔴 Provisionar Neon Postgres (Neon conectado y funcionando)
- [x] 🔴 Configurar Drizzle y primer `pnpm drizzle-kit push`
- [x] 🔴 Configurar NextAuth con proveedor Google
- [ ] 🔴 Configurar env vars en Vercel (`vercel env add`) y validar deploy autenticado en producción
- [x] 🔴 Crear layout base con header + navegación + footer
- [x] 🔴 Instalar y configurar shadcn/ui (Button, Input, Table, Card, Dialog)
- [x] 🟡 Configurar ESLint + Prettier + tsconfig estricto
- [ ] 🟡 Deploy de preview y production funcionando
- [ ] 🟢 Crear `vercel.ts` con configuración base

**Criterio de aceptación**: entro a la URL de production, hago login con Google, veo mi nombre en el header.

---

## Milestone 1 — Jugadores y ranking base

**Objetivo**: modelo de jugadores cargado y ranking público navegable.
**Estimación**: ~2-3 días.

> Estado actual (2026-04-28): admin de jugadores operativo, import CSV inicial listo, historial por jugador visible en ranking, migración de `matches` + `match_sets` aplicada en DB real y 60 partidos históricos confirmados cargados manualmente en la base. El ranking ya tiene datos suficientes para empezar a validar desempates reales. Falta convertir esta carga manual en flujo de producto para registrar resultados desde la app.

- [x] 🔴 Schema Drizzle: `users`, `players`, `seasons`, `ranking_events`, `audit_log`
- [x] 🔴 Seed de temporada 2026 (`seasons`)
- [x] 🔴 CRUD de jugadores en `/admin/jugadores` (crear, editar, marcar retirado)
- [x] 🔴 Import CSV de ranking inicial (nombre, género, puntos iniciales) → crea jugadores + `ranking_events` con `reason='initial_seed'`
- [x] 🔴 Vista pública `/` con tabs H / M mostrando ranking
- [x] 🔴 Vista `/ranking/[categoria]` con historial de eventos al hacer click en un jugador
- [x] 🔴 Cálculo de puntos vigentes = `sum(ranking_events.delta)`
- [x] 🔴 Desempate RN-11 (H2H, sets, games, sorteo) implementado
- [ ] 🟡 Link del jugador al perfil público con sus partidos jugados
- [x] 🟡 Auditoría de alta/edición de jugadores
- [ ] 🟢 Export CSV del ranking actual

**Criterio de aceptación**: cargo el CSV con 30 jugadores, veo el ranking ordenado correcto, los empates se resuelven bien.

---

## Milestone 2 — Disponibilidad semanal

**Objetivo**: los jugadores declaran disponibilidad, el admin la ve consolidada.
**Estimación**: ~1-2 días.

> Estado actual (2026-04-28): completo. Schema `weeks` + `availability` en Neon, flujo admin y formulario de jugador operativos.

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

- [x] 🔴 Schema Drizzle: `matches`, `match_sets`
- [ ] 🔴 Algoritmo `lib/fixture/propose.ts`:
  - [ ] 🔴 Filtrar jugadores disponibles activos
  - [ ] 🔴 Respetar `max_matches` declarado (RN-04, RN-05)
  - [ ] 🔴 Bloquear repetición de rival en 30 días (RN-03)
  - [ ] 🔴 Minimizar diferencia de ranking
- [ ] 🔴 Vista `/admin/semanas/[id]/fixture`:
  - [ ] 🔴 Botón "Generar propuesta" (por categoría)
  - [ ] 🔴 Edición: mover jugadores, eliminar match, agregar match manual
  - [ ] 🔴 Validación en vivo al editar (detecta violaciones de RN-03)
- [ ] 🔴 Acción admin: publicar fixture (crea filas en `matches` con `type='sorteo'`, `status='pendiente'`)
- [ ] 🔴 Vista pública `/fixture` con fixture vigente
- [ ] 🔴 `lib/fixture/message.ts` → string formateado para WhatsApp
- [ ] 🔴 Botón "Copiar mensaje" que copia al clipboard
- [ ] 🟡 Highlight de mis partidos en `/fixture` si estoy logueado
- [ ] 🟡 Auditoría de publicación

**Criterio de aceptación**: con 20 disponibles en H, el admin genera propuesta en <5s, hace 2-3 ajustes, publica, y copia un mensaje limpio para WhatsApp.

---

## Milestone 4 — Resultados y ranking automático

**Objetivo**: el admin registra resultados y el ranking se actualiza solo.
**Estimación**: ~3 días.

- [~] 🔴 `lib/rules/scoring.ts` que dado `matches` + `match_sets` devuelve los deltas de cada jugador según RN-01 y RN-02
- [x] 🔴 Validaciones de scores tenis (6-0..6-4, 7-5, 7-6, super tie-break)
- [~] 🔴 Vista `/admin/partidos` con partidos pendientes / jugados / WO
- [~] 🔴 Form de registro de resultado con formato (mr3 / set_largo) y sets dinámicos
- [x] 🔴 Soporte de empate (status=`empate`) con puntos correctos
- [x] 🔴 Soporte de W.O. (status=`wo`, `wo_loser_id`)
- [x] 🔴 Insert transaccional: `match_sets` + 2 `ranking_events` + `audit_log`
- [x] 🔴 Edición de resultado → anular eventos anteriores con nuevo evento compensatorio + nuevo resultado (nunca borrar)
- [ ] 🔴 Contadores en `/mi-perfil`: partidos esta semana / mes, desafíos aceptados mes
- [ ] 🟡 Historial visible de mis partidos con links a detalle
- [ ] 🟡 Admin puede filtrar partidos por semana / categoría / estado

**Criterio de aceptación**: registro un 6-4 / 3-6 / 10-7 → el ganador suma 60, el perdedor suma 30, el ranking se reordena correctamente.

---

## Milestone 5 — Desafíos, congelaciones, penalizaciones

**Objetivo**: cerrar las reglas del reglamento que quedan.
**Estimación**: ~2 días.

- [ ] 🔴 Schema Drizzle: `freezes`
- [ ] 🔴 Vista `/admin/congelaciones`: registrar freeze (validar máx 3/semestre RN-09)
- [ ] 🔴 Vista `/mi-perfil` muestra mi "zona desafiable" (±5 en mi categoría) con estado "puedo desafiar" / "jugamos hace X días"
- [ ] 🔴 `/admin/desafios`: registrar partido tipo desafío (valida RN-06 y RN-03, permite overrides con justificación)
- [ ] 🔴 Cron semanal `/api/cron/inactividad` protegido por `CRON_SECRET`:
  - [ ] 🔴 -40 pts a quien no jugó el último mes (RN-10)
  - [ ] 🔴 -25% a quien no juega 3 meses, idempotente
  - [ ] 🔴 -50% a quien no juega 6 meses, idempotente
  - [ ] 🔴 -100% a quien no juega 1 año, idempotente
  - [ ] 🔴 Exención para lesionados justificados (RN-10)
- [ ] 🔴 Configurar cron en `vercel.ts`
- [ ] 🟡 Contador de desafíos aceptados en el mes en `/mi-perfil`
- [ ] 🟡 Job manual "recalcular inactividad ahora" en admin

**Criterio de aceptación**: creo un freeze para un jugador, deja de aparecer en la próxima propuesta; avanzamos el tiempo y el jugador sin partidos pierde -40 al fin de mes.

---

## Milestone 6 — Campeonatos internos

**Objetivo**: registrar podios y partidos de campeonatos para aplicar los bonus del reglamento.
**Estimación**: ~1 día.

- [ ] 🔴 Schema Drizzle: `championships`, `championship_placements`
- [ ] 🔴 Vista `/admin/campeonatos`: crear campeonato (regular / clausura), registrar podio
- [ ] 🔴 Al registrar podio, insertar `ranking_events` con bonus según RN-12
- [ ] 🔴 Registrar partidos individuales del campeonato con `type='campeonato'` (no aplican límites RN-04)
- [ ] 🟡 Vista pública del podio en `/ranking/[categoria]` como "hitos de la temporada"

**Criterio de aceptación**: registro "Copa Verano campeón Pedro, finalista Juan" y Pedro suma +150, Juan suma +75.

---

## Milestone 7 — Pulido y entrega

**Objetivo**: dejar la app lista para ser usada por los socios del club.
**Estimación**: ~1-2 días.

- [ ] 🔴 Revisión mobile de todas las pantallas
- [ ] 🔴 Copy de onboarding en `/login` y en la primera visita
- [ ] 🔴 Mensaje "¿Cómo funciona?" para jugadores nuevos
- [ ] 🔴 Guía para el admin (documento separado en `docs/ADMIN_GUIDE.md` si aplica)
- [ ] 🟡 Manejo de errores amable (páginas 404 / 500 en español)
- [ ] 🟡 Tests Vitest de reglas críticas (scoring, desempates, elegibilidad desafío)
- [ ] 🟡 Test Playwright del happy path completo
- [ ] 🟢 Dominio custom del club (si lo hay)
- [ ] 🟢 Favicon + OpenGraph image

---

## Backlog transversal (no bloquea milestones)

- [ ] 🟢 Dashboard admin con métricas: jugadores activos, partidos de la semana, % participación
- [ ] 🟢 Export a PDF del fixture publicado
- [ ] 🟢 Notificación por email cuando se publica fixture (requiere decisión)
- [ ] 🟢 Estadísticas individuales (winrate, sets ganados, etc.) en perfil público

---

## Riesgos conocidos

- **Regla RN-10 escalonada (PD-01)**: la interpretación requiere confirmación del Comité antes de implementar el cron. Si se interpreta mal, jugadores pueden perder puntos injustamente.
- **Seed inicial de ranking (PD-02)**: depende del Organizador entregar el CSV. Puede ser el cuello de botella del M1.
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

Se puede arrancar el uso real tras M4 con algunas cosas manualmente gestionadas en el admin.
