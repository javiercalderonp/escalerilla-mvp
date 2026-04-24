# Decisions — Escalerilla de Tenis Club La Dehesa

> Registro ligero de decisiones arquitectónicas y de producto (ADRs). Cada entrada incluye contexto, decisión, consecuencias y estado. Cuando algo cambie, **no se borra**: se agrega un nuevo ADR que reemplace al anterior y se marca el viejo como `Superseded`.

Estados posibles: `Proposed` · `Accepted` · `Superseded` · `Rejected`.

---

## ADR-001 — Stack tecnológico: Next.js + Vercel + Postgres

**Fecha**: 2026-04-24
**Estado**: Accepted

### Contexto

Necesitamos una web app interna simple, desplegable rápido, con bajo mantenimiento. Un solo desarrollador. ~60 usuarios totales. Sin requerimientos de tiempo real.

### Decisión

- **Next.js 15+** (App Router) como framework full-stack.
- **Vercel** como hosting (Fluid Compute, Node.js 24 default).
- **Postgres** en Neon, provisionado vía Vercel Marketplace.
- Monolito: frontend y backend en el mismo proyecto Next.js. Nada de microservicios.

### Consecuencias

- Despliegue automático por push a GitHub.
- Variables de entorno (incluido `DATABASE_URL`) provisionadas por Vercel.
- Costo esperado: $0 en dev / preview y muy bajo en producción.
- Lock-in moderado con Vercel — aceptable para el uso.

---

## ADR-002 — Autenticación con Google Sign-In

**Fecha**: 2026-04-24
**Estado**: Accepted

### Contexto

Los socios del Club casi todos usan Gmail / Google Workspace. Queremos fricción mínima y no mantener contraseñas.

### Decisión

Usar **Google como único proveedor de autenticación** vía OAuth, implementado con NextAuth.

### Consecuencias

- Cero gestión de contraseñas.
- Un socio sin cuenta Google queda fuera (riesgo bajo en contexto).
- Requiere configurar OAuth credentials en Google Cloud Console.

---

## ADR-003 — Alcance MVP: solo singles hombres y mujeres

**Fecha**: 2026-04-24
**Estado**: Accepted

### Contexto

El reglamento habilita la eventual creación de una categoría de dobles ("se evaluará") y de subcategorías (A/B) según la cantidad de participantes. Cada una agrega complejidad al modelo de datos y al algoritmo de cruces.

### Decisión

MVP soporta exactamente dos categorías: **singles hombres** y **singles mujeres**. Se modelan como enum `gender` en el jugador; no hay tabla `categories` genérica.

### Consecuencias

- Modelo de datos más simple.
- Si en v2 se agrega dobles o subcategorías, habrá que refactorizar a un modelo con tabla `categories` y una entidad intermedia `player_category`.
- Documentado en `REQUIREMENTS.md` como PD-10 y PD-11.

---

## ADR-004 — Coordinación de día y hora sigue por WhatsApp

**Fecha**: 2026-04-24
**Estado**: Accepted

### Contexto

El usuario confirmó que el ritual social de coordinación por WhatsApp entre los dos jugadores funciona bien y debe preservarse. Un scheduler en la app sería sobreingeniería y cambiaría el comportamiento de la comunidad.

### Decisión

La app **no administra la coordinación de día/hora** del partido. El admin publica el fixture con la dupla; los jugadores se coordinan en WhatsApp.

### Consecuencias

- Menor superficie del sistema (no hay reservas, disponibilidad horaria, notificaciones).
- El campo `played_on` se llena solo cuando se registra el resultado.
- Imposible automatizar recordatorios cercanos al partido.

---

## ADR-005 — Desafíos: solo visualización + registro manual del admin

**Fecha**: 2026-04-24
**Estado**: Accepted

### Contexto

El reglamento tiene un flujo formal de desafío (emitir / aceptar / rechazar, causales, W.O. por no respuesta, 15 min de tolerancia, etc.). Modelar esto dentro de la app agrega bastante complejidad (estados, timers, notificaciones) para un uso que hoy funciona en WhatsApp directo.

### Decisión

Para el MVP:

- La app **visualiza** la "zona desafiable" (±5 puestos) para cada jugador y sus contadores (regla 30 días, desafíos del mes).
- La emisión, aceptación y coordinación del desafío siguen por WhatsApp, como hoy.
- Cuando el desafío se juega, el admin **registra el partido** con `type='desafio'` en `/admin/desafios`.

### Consecuencias

- No modelamos estados "desafío pendiente / aceptado / rechazado".
- El W.O. de desafío se registra manualmente por el admin.
- Si en v2 se quiere flujo formal en la app, se agrega una tabla `challenges` y se conecta a `matches`.

---

## ADR-006 — No integrar API de WhatsApp en MVP

**Fecha**: 2026-04-24
**Estado**: Accepted

### Contexto

Integrar la API de WhatsApp Business requiere aprobación de Meta, es costoso y no aporta valor crítico. El admin actualmente copia y pega mensajes en el grupo, lo cual funciona y es auditable socialmente.

### Decisión

La app **genera texto formateado** (fixture, recordatorios) que el admin **copia y pega** en WhatsApp. Cero integración con APIs de mensajería.

### Consecuencias

- Cero costo de API, cero compliance con Meta.
- El admin sigue siendo el puente humano — riesgo bajo dado que ya cumple ese rol hoy.
- Si en v2 se integra, probablemente vía un bot del grupo (no WA Business API), o simplemente dejando como está.

---

## ADR-007 — Ranking como ledger de eventos (append-only)

**Fecha**: 2026-04-24
**Estado**: Accepted

### Contexto

El reglamento tiene muchas reglas que suman o restan puntos (partidos, empates, W.O., inactividad mensual, escalonado trimestral, bonus de campeonatos, etc.). Si mantenemos un campo mutable `points` en `players`, se vuelve imposible auditar de dónde viene el valor actual o revertir un error sin reconstruir a mano.

### Decisión

Los puntos del ranking **no se almacenan** en una columna. Existen como `sum(ranking_events.delta)` por jugador. La tabla `ranking_events` es **append-only**.

Cada evento tiene:

- `player_id`
- `delta` (positivo o negativo)
- `reason` (enum: `match_win`, `inactivity_month`, `championship_bonus`, `manual_adjustment`, ...)
- `ref_type` / `ref_id` (para trazabilidad)
- `occurred_at`, `registered_by`, `note`

Correcciones se hacen con un **nuevo evento** compensatorio, nunca editando uno anterior.

### Consecuencias

- Debug trivial (`SELECT * FROM ranking_events WHERE player_id = ?`).
- Cálculo del ranking es un `GROUP BY` simple.
- Espacio en disco insignificante para ~500 partidos/año.
- Todo recálculo (ej. cambio retroactivo de un resultado) requiere aplicar `-deltaAnterior + deltaNuevo` como 2 eventos nuevos.

---

## ADR-008 — ORM: Drizzle

**Fecha**: 2026-04-24
**Estado**: Accepted

### Contexto

Opciones principales: Drizzle, Prisma, Kysely.

- **Drizzle**: SQL-first, tipos derivados del schema, muy rápido, binario pequeño, soporte nativo Neon + Vercel.
- **Prisma**: más maduro, client generado, slower cold-start, mejor DX para devs que no saben SQL.
- **Kysely**: query builder puro, requiere escribir schema en tipos a mano.

Para este equipo (un dev que sabe SQL, monorepo pequeño, prioridad cold-start en serverless), Drizzle encaja.

### Decisión

Usar **Drizzle ORM** con driver Neon HTTP.

### Consecuencias

- Schema en TS, migraciones con `drizzle-kit`.
- Cold-starts rápidos en Vercel.
- Queries más cercanas a SQL (ventaja para este dominio, que tiene queries no triviales de ranking y desempates).

---

## ADR-009 — Librería de auth: NextAuth

**Fecha**: 2026-04-24
**Estado**: Accepted

### Contexto

Opciones: NextAuth (Auth.js), Clerk, auth casera.

- **NextAuth**: gratis, self-hosted, integración Google nativa, compatible con Drizzle adapter.
- **Clerk**: excelente DX, free tier razonable, lock-in mayor, UI pre-hecha.
- **Casera**: no tiene sentido para el volumen.

Para el MVP priorizamos simplicidad y cero dependencias comerciales adicionales.

### Decisión

Usar **NextAuth (Auth.js)** con proveedor Google y Drizzle adapter.

### Consecuencias

- Cero costo.
- Sesiones en DB (tabla `sessions` via adapter).
- Si en el futuro queremos UI más pulida o features avanzadas (MFA, magic links), se puede migrar a Clerk.

---

## ADR-010 — Definición de admin: env var `ADMIN_EMAILS` (temporal)

**Fecha**: 2026-04-24
**Estado**: Accepted

### Contexto

En MVP los admins son pocos (1-3 personas). Una tabla dedicada sería premature abstraction.

### Decisión

La lista de emails admin vive en la variable de entorno `ADMIN_EMAILS` (separada por coma). Cuando un usuario se loguea con un email de esa lista, se le asigna `role='admin'` en `users`.

### Consecuencias

- Cambiar un admin requiere redeploy / `vercel env` y re-login.
- Si en v2 crece el número de admins o queremos UI para gestionarlos, se migra a tabla `admin_users` con acción correspondiente en `/admin`. Ver ADR siguiente cuando ocurra.

---

## ADR-011 — UI kit: shadcn/ui

**Fecha**: 2026-04-24
**Estado**: Accepted

### Contexto

Necesitamos componentes (tablas, forms, dialogs) con buena accesibilidad y look limpio. No tenemos diseñador.

Opciones: shadcn/ui, MUI, Chakra, Ant Design.

### Decisión

Usar **shadcn/ui** sobre Tailwind. Los componentes se copian al repo (no es librería instalada), son editables y sin deuda de abstracción.

### Consecuencias

- Código más bajo a largo plazo — ningún upgrade breaking.
- Más setup inicial que MUI (pero solo se copia lo que se usa).
- Tailwind como dependencia obligatoria.

---

## ADR-012 — Seed inicial del ranking vía CSV

**Fecha**: 2026-04-24
**Estado**: Proposed

### Contexto

El reglamento menciona que el ranking 2026 toma como referencia el ranking del año anterior. Necesitamos una forma de ingresar ~30-60 jugadores con sus puntos iniciales sin hacer 60 inserts manuales.

### Decisión (propuesta)

Pantalla `/admin/seed` que acepta un CSV con columnas `nombre, email, genero, puntos_iniciales`. Al subirlo:

1. Se crean `players` faltantes.
2. Se inserta un `ranking_event` por jugador con `reason='initial_seed'` y `delta=puntos_iniciales`.

### Consecuencias

- El admin debe preparar el CSV una sola vez.
- Si el Organizador no tiene planilla clara → alternativa: pantalla con inputs uno a uno (backup).
- Requiere confirmar formato del CSV con el Organizador.

**Pendiente**: confirmar con el Organizador antes de cerrar como `Accepted`.

---

## ADR-013 — Zona horaria `America/Santiago`

**Fecha**: 2026-04-24
**Estado**: Accepted

### Contexto

Las reglas del reglamento usan "mes", "semana", "30 días" — todos conceptos que dependen de zona horaria. El club está en Santiago, Chile.

### Decisión

Todas las fechas de cortes (inicio de semana, fin de mes, ventana de 30 días) se calculan en `America/Santiago`. Las marcas `timestamptz` en DB siguen siendo UTC, pero los cálculos las convierten.

### Consecuencias

- Usar una librería como `date-fns-tz` o `@internationalized/date` para conversiones.
- Cuidado con cron jobs (Vercel Cron corre en UTC — hay que ajustar la hora de ejecución).

---

## ADR-014 — Flujo de confirmación: jugador reporta, admin aprueba

**Fecha**: 2026-04-24
**Estado**: Accepted

### Contexto

El reglamento exige que los resultados sean reportados al Organizador. Hoy esto ocurre por WhatsApp o formulario. Al llevarlo a la app, hay tres modelos posibles:

1. Solo el admin registra (el admin es el cuello de botella).
2. Admin + confirmación de ambos jugadores (robusto, pero agrega fricción).
3. Jugador reporta → admin aprueba (intermedio).

El usuario eligió (3).

### Decisión

Los partidos tienen un estado intermedio `reportado`. El jugador ingresa el resultado desde su perfil; los puntos **no se aplican**. El admin ve un badge "partidos pendientes de confirmar" y aprueba (o edita y aprueba). Solo al confirmar se emiten los `ranking_events`.

El admin mantiene la opción de ingresar directamente como `confirmado` (HU-D1c) para casos fuera del flujo (resultado llegó por caseta).

### Consecuencias

- Se agrega estado `reportado` a `match_status` enum.
- Se agregan campos `reportedById`, `reportedAt`, `confirmedById`, `confirmedAt` en `matches`.
- El admin deja de ser el único canal de entrada — la carga operativa baja.
- Doble check entre lo reportado por jugador y lo confirmado por admin es una mejora de calidad.

---

## ADR-015 — RN-10 escalonado con aplicación única por umbral

**Fecha**: 2026-04-24
**Estado**: Accepted

### Contexto

El reglamento dice literalmente: "Un jugador que no juega en tres meses consecutivos perderá adicionalmente el 25% de sus puntos. Un jugador que no juega en seis meses consecutivos perderá automáticamente el 50% de sus puntos. Un jugador que no juega en un año perderá la totalidad de sus puntos."

La ambigüedad es si "adicionalmente" significa "recalculado mes a mes desde el tercer mes" o "aplicado una vez al cumplir el umbral".

### Decisión

**Aplicación única por umbral**. Se aplica `-25%` exactamente una vez al cumplir 90 días sin jugar. Luego `-50%` al cumplir 180 días. Luego `-100%` al cumplir 365. Jugar cualquier partido resetea el contador desde el 0. El `-40/mes` corre independientemente todos los fines de mes sin actividad.

### Consecuencias

- El `cron` de inactividad debe ser **idempotente por umbral** (no duplicar -25% si ya se aplicó y el jugador sigue sin jugar en el mes 4).
- Se documenta explícitamente en `BUSINESS_RULES_TESTS.md` §6 con casos de prueba.
- Si el Comité interpreta distinto, se puede cambiar a recálculo mensual emitiendo eventos compensatorios.

---

## ADR-016 — Seed del ranking inicial: CSV importado por admin

**Fecha**: 2026-04-24
**Estado**: Accepted

### Contexto

El reglamento pide tomar como referencia el ranking del año anterior para el seed inicial. Hay ~50 H + ~30 M jugadores; hacer esto manualmente jugador por jugador es tedioso.

### Decisión

Pantalla `/admin/seed` acepta un CSV con columnas `full_name, email, gender, initial_points, notes`. Formato definido en `DATA_MODEL.md` §5. Al importar:

1. Se crean `players` (rechaza duplicados de email).
2. Se inserta un `ranking_events` por jugador con `reason='initial_seed'` y `delta=initial_points` si > 0.
3. Todo en transacción.

### Consecuencias

- El admin prepara el CSV una sola vez al arranque de la temporada.
- Import se puede reejecutar en preview, pero en producción solo una vez (posterior requiere borrar jugadores).

---

## ADR-017 — Días fijos por categoría no se implementan en MVP

**Fecha**: 2026-04-24
**Estado**: Accepted

### Contexto

El reglamento dice "se podrá proponer días fijos para cada categoría". Esto afectaría la UX de disponibilidad y del algoritmo de cruces.

### Decisión

**No implementar en MVP**. La app usa solo la disponibilidad declarada por el jugador. Si el Comité decide días fijos, se evalúa en v2.

### Consecuencias

- Modelo de datos más simple (no hay tabla `category_fixed_days`).
- La UX de `/disponibilidad` es un form plano de checkbox de días.

---

## ADR-018 — Algoritmo de propuesta de cruces: greedy por proximidad de ranking

**Fecha**: 2026-04-24
**Estado**: Accepted

### Contexto

Opciones evaluadas: greedy por proximidad, matching óptimo global (algoritmo húngaro), rotación por recencia de juego.

### Decisión

Implementar **greedy**: ordenar jugadores disponibles por puntos desc; para cada uno, emparejar con el candidato elegible más cercano en puntos. Ver pseudocódigo en `BUSINESS_RULES_TESTS.md` §8.

### Consecuencias

- Determinístico, testeable, simple de entender.
- Puede no encontrar matchings perfectos cuando el óptimo global es distinto — el admin ajusta manualmente.
- Escalable sin problemas hasta cientos de jugadores.

---

## ADR-019 — Concurrencia entre admins: last-write-wins

**Fecha**: 2026-04-24
**Estado**: Accepted

### Contexto

Puede haber 1-3 admins simultáneos. Implementar versionado optimista agrega complejidad.

### Decisión

**Last-write-wins**. No se bloquea nada. `audit_log` permite reconstruir. Si dos admins editan el mismo partido al mismo tiempo, la última escritura queda — ambos cambios quedan registrados.

### Consecuencias

- UI sin estados de "este recurso está siendo editado".
- Bugs raros de "pisar cambios del otro admin" son aceptables dado el volumen.

---

## ADR-020 — Empate en MR3 permitido sin causal obligatoria

**Fecha**: 2026-04-24
**Estado**: Accepted

### Contexto

El reglamento dice que un partido MR3 puede terminar en empate si "1-1 en sets y juegos idénticos, sin tiempo para el super tie-break". La implementación podría exigir que el admin marque la causal.

### Decisión

El admin puede marcar cualquier MR3 como empate (checkbox "Fue empate") **sin causal obligatoria**. La confianza está en el admin.

### Consecuencias

- Formulario más simple.
- Riesgo bajo de abuso dado que el admin es una persona confiable.

---

## ADR-021 — Ventana de 30 días: corridos desde fecha del partido

**Fecha**: 2026-04-24
**Estado**: Accepted

### Contexto

"30 días" en RN-03 puede interpretarse como mes calendario, 30 días corridos, o 4 semanas ISO.

### Decisión

**30 días corridos** desde la fecha del partido anterior (`played_on`). Cumplir exactamente 30 días ya permite un nuevo partido.

### Consecuencias

- `date-fns.differenceInDays(asOfDate, lastPlayedOn) >= 30` en código.
- Se aplica a sorteos, desafíos y campeonatos por igual.

---

## ADR-022 — Semana ISO y mes calendario para límites

**Fecha**: 2026-04-24
**Estado**: Accepted

### Contexto

RN-04 dice "máx 3/semana y 4/mes". La semana puede ser ISO (lunes-domingo) o 7 días móviles; el mes puede ser calendario o 30 días móviles.

### Decisión

- **Semana**: ISO-8601 (lunes 00:00 → domingo 23:59:59 `America/Santiago`).
- **Mes**: calendario `America/Santiago`.

### Consecuencias

- Los límites se resetean cada lunes y cada día 1 del mes.
- Alineado con cómo los jugadores piensan el tiempo.

---

## ADR-023 — Versiones de dependencias y herramientas

**Fecha**: 2026-04-24
**Estado**: Accepted

### Contexto

Los agentes pueden instalar versiones incompatibles si no se fijan explícitamente.

### Decisión

| Dependencia | Versión mínima |
|---|---|
| Next.js | `^15.0.0` |
| React | `^19.0.0` |
| Node.js | `24.x` (LTS) |
| TypeScript | `^5.6.0` |
| Drizzle ORM | `^0.35.0` |
| Drizzle Kit | `^0.28.0` |
| NextAuth (Auth.js) | `^5.0.0` |
| Tailwind CSS | `^4.0.0` |
| shadcn/ui | última (copiada al repo) |
| Zod | `^3.23.0` |
| date-fns | `^4.1.0` |
| date-fns-tz | `^3.2.0` |
| lucide-react | `^0.453.0` |
| Vitest | `^2.1.0` |
| Playwright | `^1.48.0` |
| Biome | `^1.9.0` |
| pnpm | `^9.0.0` |

### Consecuencias

- Lockfile (`pnpm-lock.yaml`) commiteado.
- Actualizaciones mayores requieren ADR nuevo.

---

## ADR-024 — Biome como linter y formatter

**Fecha**: 2026-04-24
**Estado**: Accepted

### Contexto

ESLint + Prettier es el estándar pero requiere dos binarios y configuración dual. Biome los reemplaza con un binario único escrito en Rust, más rápido.

### Decisión

Usar **Biome** para lint + format. Configuración en `biome.json`.

### Consecuencias

- Un solo comando: `pnpm biome check --write .`.
- Integraciones de IDE disponibles (VSCode extension).
- Si alguna regla no está soportada, se documenta y se busca workaround.

---

## ADR-025 — Anti-requisitos explícitos del MVP

**Fecha**: 2026-04-24
**Estado**: Accepted

### Contexto

"Out of scope" a menudo se interpreta como "todavía no". Los agentes IA en particular tienden a sobreimplementar.

### Decisión

Se documenta una lista explícita de **cosas que NO deben implementarse** en MVP, incluso si son "features típicas" en apps similares. Ver `ARCHITECTURE.md` §12.

### Consecuencias

- Los agentes no generan notificaciones, chat, reservas, etc.
- Cualquier PR que agregue algo de la lista debe justificarse y actualizar este ADR.

---

## ADR-026 — Flujo de reporte-aprobación: estado `reportado` en matches

**Fecha**: 2026-04-24
**Estado**: Accepted

### Contexto

Derivado de ADR-014 (PD-09). El schema necesita representar un partido con resultado ingresado pero no aplicado al ranking.

### Decisión

El enum `match_status` incluye `reportado`. Un partido en este estado tiene `match_sets` llenos, `format` no-nulo, `winnerId` propuesto, pero **no tiene `ranking_events` asociados** hasta confirmación. Ver `DATA_MODEL.md` §2.

### Consecuencias

- Un jugador puede reportar, editar y volver a reportar hasta que el admin confirme.
- Admin puede editar el resultado reportado antes de confirmar.
- Correcciones post-confirmación siguen usando `match_correction` event (ADR-007).

---

## Pendientes de decisión

Items que todavía no tienen ADR porque requieren input del Comité / Organizador o son prematuros:

- **Dominio custom** del club (`escalerilla.cl.dehesa.cl`, etc.).
- **Política de backups de la DB**: Neon lo ofrece por branch. Confirmar retención.
- **Politica de privacidad**: antes de salir a producción.
- **Flujo de baja permanente de jugador**: ¿borrado o soft-delete? Hoy se decide `retirado` (soft).
- **Email transaccional** (notificación de fixture, etc.): descartado para MVP pero puede volver.
- **Integración con el sistema de reservas del club** (si existe uno digital): fuera de alcance hasta saber si existe.
- **Interpretación exacta de RN-10 escalonado** (PD-01 en REQUIREMENTS.md): confirmar con Comité antes de implementar cron.
- **Soporte para subcategorías A/B** dentro de H/M (reglamento lo menciona): evaluación v2.

---

## Cómo agregar una nueva decisión

1. Copiar la plantilla:
   ```md
   ## ADR-XXX — Título corto

   **Fecha**: YYYY-MM-DD
   **Estado**: Proposed | Accepted | Superseded | Rejected

   ### Contexto
   ¿Qué problema estamos resolviendo? ¿Qué sabemos?

   ### Decisión
   ¿Qué decidimos?

   ### Consecuencias
   ¿Qué gana y pierde el proyecto con esta decisión?
   ```
2. Asignar el número siguiente al último ADR.
3. Si reemplaza a uno anterior, cambiar el estado del anterior a `Superseded` y agregar nota con el nuevo ADR.
4. Commitear junto al cambio de código / doc que lo motivó.
