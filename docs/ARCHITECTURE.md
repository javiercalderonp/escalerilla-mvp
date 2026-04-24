# Architecture — Escalerilla de Tenis Club La Dehesa

> Arquitectura técnica del MVP. El objetivo es **simple, estándar y mantenible**, no óptimo. Un solo desarrollador debe poder entender y mantener el sistema completo en una tarde.

---

## 1. Principios guía

1. **Monolito Next.js**. Una sola app desplegada en Vercel. Sin microservicios, sin colas, sin workers externos.
2. **Server-first**. Server Components por defecto. Server Actions para mutaciones. JS en el cliente solo donde aporta valor.
3. **Estándar sobre novedoso**. Se prefieren librerías populares con documentación sólida antes que las últimas moda.
4. **Datos auditables**. Los puntos del ranking se reconstruyen desde un ledger append-only, no se mutan.
5. **WhatsApp-friendly**. La app genera textos que el admin copia y pega, en lugar de integrar APIs de mensajería.

---

## 2. Stack

| Capa | Tecnología | Versión mínima |
|---|---|---|
| Framework | **Next.js** (App Router, Turbopack) | `^15.0.0` |
| Lenguaje | TypeScript | `^5.6.0` |
| UI | Tailwind CSS + shadcn/ui | Tailwind `^4.0.0` |
| Íconos | `lucide-react` | `^0.453.0` |
| Backend | Route Handlers / Server Actions dentro del mismo Next.js | — |
| Base de datos | **Postgres** (Neon, provisionado vía Vercel Marketplace) | — |
| ORM | **Drizzle** (ADR-008) | Drizzle `^0.35`, Kit `^0.28` |
| Auth | **NextAuth (Auth.js)** con proveedor Google (ADR-009) | `^5.0.0` |
| Validación | Zod | `^3.23.0` |
| Fechas | date-fns + date-fns-tz (`America/Santiago`) | `^4.1.0` / `^3.2.0` |
| Tests unit | Vitest | `^2.1.0` |
| Tests e2e | Playwright (1 happy path) | `^1.48.0` |
| Lint + format | **Biome** (reemplaza ESLint + Prettier) | `^1.9.0` |
| Package manager | pnpm | `^9.0.0` |
| Hosting | **Vercel** con Fluid Compute (Node.js 24 runtime) | Node `24.x` |
| Tareas programadas | **Vercel Cron** (para recalcular penalización por inactividad) | — |
| Env vars | `vercel env` (preview / production) | — |

Ver ADR-023 y ADR-024 para el detalle de versiones y herramientas elegidas.

**Notas del entorno Vercel**:

- Fluid Compute es el default — funciones Node.js estándar, sin restricciones de Edge runtime.
- Timeout default de 300s es más que suficiente para cualquier cálculo (ranking completo con ~60 jugadores y cientos de eventos se resuelve en <1s).
- Neon Postgres del Marketplace inyecta `DATABASE_URL` automáticamente.

---

## 3. Modelo de datos

Notación: `pk` = primary key, `fk` = foreign key, `ix` = indexed.

### `users`
Cuentas autenticadas vía Google (admins e invitados). Los jugadores no siempre tienen que tener cuenta (el admin puede crearlos sin email).

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | pk |
| email | text | unique, `ix` |
| name | text | del perfil Google |
| image | text | avatar |
| role | enum | `admin` \| `player` \| `guest` |
| player_id | uuid | fk → `players.id`, nullable |
| created_at | timestamptz | |

### `players`
Socios que participan de la escalerilla. Pueden existir sin `user` asociado (ej. un socio que aún no se ha logueado).

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | pk |
| full_name | text | |
| email | text | nullable, unique si no-nulo |
| gender | enum | `M` \| `F` |
| status | enum | `activo` \| `congelado` \| `retirado` |
| initial_points | int | puntos con los que arrancó la temporada |
| created_at | timestamptz | |

### `seasons`
Una temporada corresponde a un año calendario. Semestres se derivan por fecha.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | pk |
| year | int | ej. 2026 |
| status | enum | `activa` \| `cerrada` |

### `weeks`
Semana operativa de la escalerilla. Una por temporada por semana ISO.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | pk |
| season_id | uuid | fk → `seasons.id` |
| iso_week | int | 1..53 |
| start_date | date | lunes de la semana |
| status | enum | `disponibilidad_abierta` \| `disponibilidad_cerrada` \| `fixture_publicado` \| `cerrada` |

### `availability`
Declaración de disponibilidad de un jugador para una semana.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | pk |
| player_id | uuid | fk |
| week_id | uuid | fk |
| days | text[] | ej. `['LUN','MAR','JUE']` |
| max_matches | int | 0, 1, 2 o 3 |
| created_at | timestamptz | |

**Constraint**: `unique(player_id, week_id)`.

### `matches`
Todo partido registrable: sorteo, desafío o campeonato. Ver schema Drizzle completo en `DATA_MODEL.md` §2.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | pk |
| week_id | uuid | fk, nullable (partidos de campeonato pueden no tener week) |
| category | enum | `M` \| `F` |
| type | enum | `sorteo` \| `desafio` \| `campeonato` |
| player1_id | uuid | fk |
| player2_id | uuid | fk |
| played_on | date | nullable hasta que se juega |
| status | enum | `pendiente` \| `reportado` \| `confirmado` \| `wo` \| `empate` |
| wo_loser_id | uuid | fk, nullable; solo si `status='wo'` |
| format | enum | `mr3` \| `set_largo` |
| winner_id | uuid | fk, nullable en empate / pendiente |
| championship_id | uuid | fk → `championships.id`, nullable |
| reported_by_id | uuid | fk → `users.id`, quién reportó (jugador o admin) |
| confirmed_by_id | uuid | fk → `users.id`, admin que confirmó |
| reported_at | timestamptz | nullable |
| confirmed_at | timestamptz | nullable |
| created_at | timestamptz | |

**Transiciones**: ver `BUSINESS_RULES_TESTS.md` §10. Los puntos del ranking se aplican solo al pasar a `confirmado`, `wo` o `empate`.

### `match_sets`
Desglose de sets del partido. 1 a 3 filas por `match`.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | pk |
| match_id | uuid | fk |
| set_number | int | 1, 2, o 3 |
| games_p1 | int | |
| games_p2 | int | |
| tiebreak_p1 | int | nullable |
| tiebreak_p2 | int | nullable |

### `freezes`
Congelaciones de disponibilidad.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | pk |
| player_id | uuid | fk |
| season_id | uuid | fk |
| semester | int | 1 o 2 |
| week_id | uuid | fk |
| reason | enum | `lesion` \| `viaje` \| `otro` |
| notes | text | nullable |
| registered_by | uuid | fk |
| created_at | timestamptz | |

**Regla de aplicación**: el admin no puede crear más de 3 freezes por jugador por semestre (validación de aplicación, no DB constraint).

### `championships`
Campeonatos internos del club para trackear podios.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | pk |
| name | text | ej. "Copa Verano 2026" |
| kind | enum | `regular` \| `clausura` |
| category | enum | `M` \| `F` |
| started_on | date | |
| ended_on | date | nullable |

### `championship_placements`
Podio de un campeonato (para aplicar bonus).

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | pk |
| championship_id | uuid | fk |
| player_id | uuid | fk |
| placement | enum | `campeon` \| `finalista` \| `semifinalista` \| `cuartofinalista` |

### `ranking_events` ← núcleo del sistema
Ledger append-only. Cada evento es un delta de puntos con un motivo.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | pk |
| player_id | uuid | fk, `ix` |
| occurred_at | timestamptz | `ix` |
| delta | int | puede ser negativo |
| reason | enum | `initial_seed` \| `match_win` \| `match_loss_3s` \| `match_loss_2s` \| `match_loss_set_largo` \| `match_draw` \| `wo_win` \| `wo_loss` \| `championship_bonus` \| `inactivity_month` \| `inactivity_3mo` \| `inactivity_6mo` \| `inactivity_1y` \| `manual_adjustment` \| `match_correction` |
| ref_type | text | `match`, `championship_placement`, `manual`, etc. |
| ref_id | uuid | nullable |
| note | text | nullable, requerido si `manual_adjustment` |
| registered_by | uuid | fk |

**Por qué ledger**:

- El ranking vigente = suma de `delta` por jugador. Se calcula con una query simple y se puede cachear.
- Cualquier corrección se hace con un nuevo evento, nunca editando uno anterior. Historial completo intacto.
- Debug trivial: "¿por qué este jugador tiene X puntos?" → `select * from ranking_events where player_id=...`.

### `audit_log`
Para acciones de admin.

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid | pk |
| occurred_at | timestamptz | |
| actor_id | uuid | fk → users |
| action | text | ej. `match.register`, `match.edit`, `freeze.create` |
| entity_type | text | |
| entity_id | uuid | |
| payload | jsonb | diff o snapshot |

---

## 4. Rutas y pantallas

| Ruta | Acceso | Propósito |
|---|---|---|
| `/` | público | Landing + ranking H y M (tabs). |
| `/fixture` | público | Fixture de la semana actual. |
| `/login` | público | Google Sign-In. |
| `/disponibilidad` | jugador | Formulario semanal (días + cupo). |
| `/mi-perfil` | jugador | Mis partidos, mis contadores, mi zona desafiable. |
| `/ranking/[categoria]` | público | Vista detallada por categoría con historial. |
| `/admin` | admin | Dashboard con estado semana actual + accesos rápidos. |
| `/admin/jugadores` | admin | CRUD de jugadores. |
| `/admin/semanas` | admin | Abrir/cerrar semana, ver disponibilidad consolidada. |
| `/admin/semanas/[id]/fixture` | admin | Generar propuesta, editar, publicar, copiar texto para WhatsApp. |
| `/admin/partidos` | admin | Registrar resultado / editar / marcar W.O. |
| `/admin/desafios` | admin | Registrar partido tipo desafío (con validación RN-06). |
| `/admin/congelaciones` | admin | Registrar freeze. |
| `/admin/campeonatos` | admin | Registrar campeonato + podio + partidos individuales. |
| `/admin/auditoria` | admin | Ver log. |

---

## 5. Flujos clave

### 5.1 Propuesta automática de cruces (HU-C1)

1. Input: `week_id` y `category`.
2. Traer jugadores `activos` con `availability.max_matches > 0` para esa semana y categoría.
3. Calcular puntos vigentes de cada uno (sumando `ranking_events`).
4. Ordenar por puntos desc.
5. **Algoritmo greedy**: recorrer la lista, emparejar cada jugador con el más cercano en ranking que:
   - No haya jugado con él en los últimos 30 días (query a `matches`).
   - No haya alcanzado su `max_matches` declarado para la semana.
   - No tenga aún su partido asignado en esta propuesta.
6. Devolver propuesta con jugadores no emparejados marcados.
7. Admin edita manualmente si quiere (drag & drop o selects).
8. Al publicar, se crean las filas en `matches` con `type='sorteo'` y `status='pendiente'`.

**Nota**: este algoritmo no es óptimo (no busca el matching perfecto tipo Hungarian). Para ~30 jugadores basta greedy. Si crece mucho se reemplaza.

### 5.2 Registro de resultado (HU-D1)

1. Admin abre el partido pendiente.
2. Elige `format` (mr3 / set_largo) — se pre-llena si hubo una reserva declarada (no en MVP).
3. Ingresa sets (1-3 filas según formato).
4. Sistema valida:
   - Scores válidos de tenis (6-X, 7-5, 7-6, etc.).
   - Coherencia entre sets y ganador.
   - Si es empate según RN-02, permite `status='empate'`.
5. Al guardar:
   - Se insertan `match_sets`.
   - Se calcula la puntuación aplicable según RN-01 + formato.
   - Se insertan 2 `ranking_events` (uno por jugador).
   - Se graba `audit_log`.

### 5.3 Cálculo del ranking (HU-E1)

**Query vigente**:

```sql
select p.id, p.full_name, p.gender, coalesce(sum(re.delta), 0) as points
from players p
left join ranking_events re on re.player_id = p.id
where p.status <> 'retirado' or true  -- retirados se muestran con nota
group by p.id
order by points desc;
```

**Desempate (RN-11)**: si dos filas tienen `points` iguales, se resuelve en JS/TS aplicando en orden:

1. Consultar `matches` H2H entre ese par y sumar V-D.
2. Sumar sets de `match_sets` (g - p).
3. Sumar juegos de `match_sets` (g - p).
4. Si persiste, sorteo determinístico (orden por nombre, por ejemplo; o random con seed registrado en audit).

### 5.4 Penalización por inactividad (RN-10)

Cron semanal en Vercel (`/api/cron/inactividad`, protegido por secret header).

Algoritmo:

1. Para cada jugador activo no-retirado:
   - Contar partidos en los últimos 30 días excluyendo congelaciones activas.
   - Si 0 partidos y no está congelado → insertar `ranking_event` con `reason='inactivity_month'` (-40), `occurred_at=fin_de_mes_calendario`.
2. Al final de cada trimestre / semestre / año, si el jugador no tiene partidos en ese período:
   - Insertar eventos de `-25% / -50% / -100%` calculando sobre puntos vigentes (snapshot).
3. Registrar en `audit_log` la ejecución del cron con cuántos eventos creó.

**Idempotencia**: antes de insertar, verificar que no exista ya un evento de ese tipo para ese jugador en ese período.

### 5.5 Generación de mensaje para WhatsApp (HU-C4)

Función TS pura que toma el fixture publicado y devuelve un string tipo:

```
🎾 FIXTURE ESCALERILLA · Semana 15 (7–13 abr)

SINGLES HOMBRES
• Pedro G. vs. Juan L.
• Diego R. vs. Mateo P.

SINGLES MUJERES
• Ana S. vs. María T.

Coordinen día y hora por acá. ¡Suerte a todos!
```

El admin ve un botón "Copiar mensaje" y lo pega en WhatsApp. No se llama API externa.

---

## 6. Seguridad y autorización

- Todas las rutas `/admin/*` verifican `session.user.role === 'admin'` en el layout del segmento.
- Las server actions validan rol antes de cualquier mutación.
- El cron está protegido por `CRON_SECRET` env var validado contra `Authorization: Bearer` header (estándar Vercel Cron).
- Emails de admin se gestionan con una env var `ADMIN_EMAILS` (lista separada por coma) o una tabla dedicada (ver ADR-010, pendiente).

---

## 7. Entornos y despliegue

| Entorno | Origen | URL | Base de datos |
|---|---|---|---|
| local | dev | `http://localhost:3000` | branch Neon local |
| preview | ramas no-main | `*-escalerilla.vercel.app` | branch Neon preview (auto) |
| production | rama `main` | `escalerilla.vercel.app` (o dominio custom) | branch Neon main |

**Variables de entorno** (gestionadas con `vercel env`):

- `DATABASE_URL` (Neon, auto-provisionado por Marketplace).
- `NEXTAUTH_SECRET`.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- `CRON_SECRET`.
- `ADMIN_EMAILS` (mientras no exista tabla dedicada).

---

## 8. Estructura de carpetas propuesta

```
escalerilla-mvp/
├── app/                     # Next.js App Router
│   ├── (public)/            # /, /fixture, /ranking, /login
│   ├── (player)/            # /disponibilidad, /mi-perfil
│   ├── admin/
│   ├── api/
│   │   ├── auth/[...nextauth]/
│   │   └── cron/
│   └── layout.tsx
├── components/              # UI compartida
├── lib/
│   ├── db/                  # Drizzle schema + client
│   ├── ranking/             # cálculo, desempates, penalizaciones
│   ├── fixture/             # algoritmo de cruces
│   ├── rules/               # RN-01..RN-15 traducidas a TS
│   └── auth.ts
├── drizzle/                 # migrations
├── docs/
├── public/
└── vercel.ts                # config Vercel (crons, etc.)
```

---

## 9. Testing (mínimo aceptable)

- **Unit**: funciones puras de `lib/ranking/*` y `lib/rules/*` (Vitest). Cobertura alta aquí es crítica — son las reglas del reglamento.
- **E2E**: 1 flow feliz con Playwright (login → declarar disponibilidad → admin arma fixture → registra resultado → ve ranking actualizado). Nada más.
- **Sin tests de integración intermedios** en MVP.

---

## 10. Supuestos

- Volumen: ≤100 jugadores, ≤500 partidos/año. No aplicaremos optimizaciones prematuras de DB.
- El admin es una persona confiable (no modelamos adversarios internos).
- Los resultados que el admin registra son correctos; no hay doble confirmación en MVP.
- Zona horaria: `America/Santiago`. Las semanas se calculan con esta TZ (importante para cortes de mes/semestre).
- Todos los jugadores aceptan que sus nombres aparezcan en el ranking público del club.

---

## 11. Fuera de la arquitectura (MVP)

- WebSockets / tiempo real — el admin recarga la página.
- Notificaciones push / email — no hay ningún envío automático a jugadores.
- API pública — ningún consumidor externo.
- Internacionalización — español únicamente.
- Métricas de negocio / analytics — Vercel Analytics es suficiente.

---

## 12. Anti-requisitos (lista explícita de "NO hacer")

> Dirigido a agentes IA y devs: estas cosas **no deben aparecer** en el MVP. Agregarlas sin justificación en ADR es violación explícita del alcance.

### Integraciones no deseadas

- ❌ **No integrar la API de WhatsApp Business**. El admin copia y pega mensajes generados por la app.
- ❌ **No enviar emails automáticos** a jugadores (ni transaccionales, ni recordatorios).
- ❌ **No implementar notificaciones push**.
- ❌ **No integrar con servicios de pago** (Stripe, MercadoPago, etc.).
- ❌ **No integrar con reserva de canchas** (ni APIs del Club ni de terceros).

### Features no deseadas

- ❌ **No implementar chat dentro de la app**. WhatsApp es el canal de conversación.
- ❌ **No implementar scheduler de día/hora** del partido. Los jugadores coordinan por WhatsApp.
- ❌ **No implementar flujo formal de emisión/aceptación de desafíos** (estados pending/accepted/rejected con timers). Ver ADR-005.
- ❌ **No implementar categoría de dobles**. Ver ADR-003.
- ❌ **No implementar subcategorías A/B** dentro de H/M. Ver ADR-003.
- ❌ **No implementar "días fijos por categoría"**. Ver ADR-017.
- ❌ **No implementar selección de canchas**.
- ❌ **No implementar ratings/reseñas de jugadores**.
- ❌ **No implementar "buscar compañero de entrenamiento"**.

### Decisiones técnicas no deseadas

- ❌ **No usar Edge runtime** de Vercel. Todo es Node.js Fluid Compute.
- ❌ **No usar Server-Sent Events o WebSockets** para el ranking. Se recarga la página.
- ❌ **No usar un BFF separado**. El Next.js App Router es el único backend.
- ❌ **No crear microservicios**.
- ❌ **No agregar Redis / KV / Edge Config** — el Postgres basta para MVP.
- ❌ **No agregar colas** (Inngest, BullMQ, Vercel Queues). Los crons de Vercel son suficientes.
- ❌ **No usar Prisma, TypeORM, Sequelize**. El ORM es Drizzle (ADR-008).
- ❌ **No usar Clerk o Supabase Auth**. El auth es NextAuth con Google (ADR-009).
- ❌ **No usar MUI, Chakra, Ant Design**. La UI es shadcn/ui (ADR-011).
- ❌ **No usar CSS-in-JS** (styled-components, emotion). Tailwind únicamente.
- ❌ **No usar Redux, Zustand, Jotai** para estado global. Server Components + Server Actions.
- ❌ **No crear "dashboards de analytics"** ni exportar a Google Analytics / Mixpanel.
- ❌ **No implementar dark mode**.
- ❌ **No implementar multi-idioma**.
- ❌ **No implementar tests de integración intermedios**. Solo unit (Vitest) + 1 e2e (Playwright). Ver §9.

### Código que no debe escribirse

- ❌ **No escribir loops de retry con backoff** salvo que una librería lo exija. El admin puede reintentar.
- ❌ **No implementar "feature flags"** ni A/B testing.
- ❌ **No implementar paginación infinita**. Paginación clásica con "siguiente/anterior" donde haga falta.
- ❌ **No agregar animaciones Framer Motion** salvo transiciones naturales de Tailwind.
- ❌ **No comentar cada función** — solo comentar invariantes no obvios.
- ❌ **No agregar i18n library** (next-intl, react-intl). El copy está hardcodeado en español.
- ❌ **No crear wrappers genéricos alrededor de cada cosa**. Código directo.

### Reglas de repositorio

- ❌ **No crear carpetas vacías** "para el futuro".
- ❌ **No crear archivos placeholder** con contenido trivial.
- ❌ **No commitear** `node_modules`, `.env`, build outputs, etc.
- ❌ **No usar `--no-verify`** en commits.
- ❌ **No deshabilitar tests** que fallen — arreglarlos.

---

## 13. Qué SÍ debe hacer el agente en primera pasada

Un resumen afirmativo para evitar ambigüedad:

1. Seguir el **orden de milestones** de `TASKS.md` (M0 → M7).
2. Escribir el **schema Drizzle exacto** de `DATA_MODEL.md` §2. No agregar campos ni tablas.
3. Implementar las **reglas de negocio** según `BUSINESS_RULES_TESTS.md` y escribir los tests ahí indicados.
4. Seguir los **wireframes y copy** de `UX_SPEC.md`.
5. Usar **Server Components por defecto**; agregar `'use client'` solo cuando sea necesario (interacción o hook).
6. Todas las mutaciones van por **Server Actions** con Zod en la entrada.
7. Persistir **todo cambio relevante** en `audit_log`.
8. Al terminar cada milestone, correr `pnpm test` y dejar en verde.
9. Preguntar al humano si una ambigüedad no está cubierta por los docs — **no inventar**.
