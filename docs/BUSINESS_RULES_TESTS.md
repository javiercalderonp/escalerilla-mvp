# Business Rules — Casos de prueba

> **Propósito**: cada regla de negocio de `REQUIREMENTS.md` (RN-01 … RN-15) acompañada de sus **casos de prueba canónicos** con input y output explícitos. Esto es la especificación que los agentes deben respetar al implementar `lib/rules/*`, `lib/ranking/*` y `lib/fixture/*`.
>
> **Formato**: cada sección tiene pseudocódigo y casos `dado → cuándo → entonces`. Los tests Vitest de `lib/rules/*.test.ts` deben cubrir al menos todos los casos aquí listados.

---

## 1. Validación de scores de tenis (RN-02)

### 1.1 Set corto (modalidad MR3, sets 1 y 2)

Un **set corto válido** cumple:

- Un jugador llega a 6 juegos con diferencia ≥ 2 → `(6, 0)..(6, 4)`.
- Un jugador llega a 7-5 → `(7, 5)`.
- Tie-break a 7-6 → `(7, 6)` con `tiebreakP1`/`tiebreakP2` donde el ganador llega a 7 con diferencia ≥ 2.

### 1.2 Super tie-break (3er set de MR3)

- Se guarda en `gamesP1` / `gamesP2`.
- El ganador llega a 10 con diferencia ≥ 2.
- Ejemplos válidos: `(10, 8)`, `(12, 10)`, `(10, 5)`.
- Ejemplos inválidos: `(10, 9)`, `(9, 10)`.

### 1.3 Set largo (modalidad `set_largo`)

- Un jugador llega a 9 con diferencia ≥ 2 → `(9, 0)..(9, 7)`.
- Si hay empate 8-8 → se juega tie-break a 7 → `(9, 8)` con `tiebreakP1`/`tiebreakP2` donde el ganador llega a 7 con diferencia ≥ 2.

### 1.4 Función `isValidSet(set, opts)` — contrato

```ts
type SetInput = {
  gamesP1: number;
  gamesP2: number;
  tiebreakP1?: number | null;
  tiebreakP2?: number | null;
};

type ValidationContext = {
  format: 'mr3' | 'set_largo';
  setNumber: 1 | 2 | 3;
};

function isValidSet(set: SetInput, ctx: ValidationContext):
  { valid: true } | { valid: false; reason: string };
```

### 1.5 Casos de prueba (`lib/rules/score.test.ts`)

| Input | Contexto | Resultado esperado |
|---|---|---|
| `(6, 0)` | mr3 set 1 | ✅ valid |
| `(6, 4)` | mr3 set 1 | ✅ valid |
| `(7, 5)` | mr3 set 1 | ✅ valid |
| `(7, 6)` tb `(7, 3)` | mr3 set 1 | ✅ valid |
| `(7, 6)` tb `(7, 6)` | mr3 set 1 | ❌ tie-break requiere diferencia ≥2 |
| `(6, 5)` | mr3 set 1 | ❌ debe llegar a 7-5 o 7-6 |
| `(8, 6)` | mr3 set 1 | ❌ no existe 8-6 en set corto |
| `(6, 7)` tb `(3, 7)` | mr3 set 1 | ✅ valid (gana jugador 2) |
| `(10, 7)` | mr3 set 3 | ✅ valid (super tie-break) |
| `(10, 9)` | mr3 set 3 | ❌ diferencia <2 |
| `(12, 10)` | mr3 set 3 | ✅ valid |
| `(9, 7)` | mr3 set 3 | ❌ super tb requiere llegar a 10 |
| `(9, 7)` | set_largo único | ✅ valid |
| `(9, 8)` tb `(7, 4)` | set_largo único | ✅ valid |
| `(9, 8)` sin tb | set_largo único | ❌ 9-8 requiere tie-break |
| `(8, 8)` | set_largo único | ❌ debe resolverse con tb |

### 1.6 Validación de partido completo (`isValidMatchScore`)

```ts
function isValidMatchScore(
  sets: SetInput[],
  format: 'mr3' | 'set_largo',
  isDraw: boolean,
): { valid: true; winnerIndex: 1 | 2 | null } | { valid: false; reason: string };
```

Reglas globales:

- Si `format='set_largo'`: exactamente 1 set.
- Si `format='mr3'`: entre 2 y 3 sets.
- Cada set debe ser válido individualmente.
- Si `isDraw=false`: debe haber un ganador claro (más sets ganados, o único set largo).
- Si `isDraw=true`: sets empatados en cantidad (ej. 1-1 en MR3 o 1 set largo 8-8 sin tb que se habla como draw — **no implementado en MVP**: los agentes deben rechazar `isDraw=true` + set_largo sin tiebreak).

Casos:

| Sets | Format | isDraw | Resultado |
|---|---|---|---|
| `[(6,4), (6,3)]` | mr3 | false | ✅ winner=1 |
| `[(6,4), (3,6), (10,7)]` | mr3 | false | ✅ winner=1 |
| `[(6,4), (3,6)]` | mr3 | true | ✅ draw |
| `[(6,4), (3,6)]` | mr3 | false | ❌ 1-1 sin 3er set requiere draw=true |
| `[(9,7)]` | set_largo | false | ✅ winner=1 |
| `[(9,7), (6,4)]` | set_largo | false | ❌ set_largo solo 1 set |
| `[(6,4)]` | mr3 | false | ❌ mr3 requiere mínimo 2 sets |

---

## 2. Puntuación por resultado (RN-01)

### 2.1 Función `calculateMatchPoints` — contrato

```ts
type MatchOutcome =
  | { type: 'win_loss'; format: 'mr3' | 'set_largo'; winnerWent3Sets: boolean }
  | { type: 'draw' }
  | { type: 'wo' };

type PlayerPoints = { winner: number; loser: number } | { both: number };

function calculateMatchPoints(outcome: MatchOutcome): PlayerPoints;
```

### 2.2 Casos

| Outcome | Puntos ganador | Puntos perdedor |
|---|---:|---:|
| `win_loss` format `mr3`, `winnerWent3Sets=false` (2-0) | +60 | +20 |
| `win_loss` format `mr3`, `winnerWent3Sets=true` (2-1) | +60 | +30 |
| `win_loss` format `set_largo` | +60 | +10 |
| `draw` | +35 ambos | +35 ambos |
| `wo` | +60 | -20 |

> **Regla**: "winnerWent3Sets" significa que el tercer set (super tie-break) se jugó. Si el perdedor perdió 2-0 (sin tie-break final), aplica la regla "perdedor 2 sets" (+20). Si perdió 2-1 (fue a tie-break), aplica "perdedor 3 sets" (+30). Esta distinción viene de RN-01 del reglamento.

### 2.3 Casos edge

- Partido MR3 que termina 1-1 por tiempo agotado pero **con primer set ganado por P1** → NO es draw; es win_loss con P1 ganador. Pero el reglamento dice "puede terminar en empate" si juegos idénticos. Los agentes deben exponer esta distinción en la UI: el admin marca explícitamente `isDraw`.

---

## 3. Regla de 30 días sin repetir rival (RN-03)

### 3.1 Función `canPlayAgainst` — contrato

```ts
function canPlayAgainst(
  playerAId: string,
  playerBId: string,
  asOfDate: Date,           // generalmente la fecha propuesta del partido
  deps: { getLastMatchDate: (a: string, b: string) => Promise<Date | null> },
): Promise<{ allowed: true } | { allowed: false; lastPlayedOn: Date; daysAgo: number }>;
```

Lógica: si el último partido entre A y B (en estado `confirmado|empate|wo`) fue hace menos de 30 días corridos, `allowed=false`.

### 3.2 Casos

| Último partido jugado | asOfDate | Resultado |
|---|---|---|
| null (nunca jugaron) | 2026-04-24 | ✅ allowed |
| 2026-03-24 | 2026-04-24 | ✅ allowed (exacto 31 días) |
| 2026-03-25 | 2026-04-24 | ❌ 30 días justos — regla "menos de" |
| 2026-03-26 | 2026-04-24 | ❌ 29 días |
| 2026-04-23 | 2026-04-24 | ❌ 1 día |

> **Interpretación literal**: la regla dice "no pueden jugar más de una vez cada 30 días". Asumimos que cumplir exactamente 30 días **ya permite** el siguiente partido. Si el último fue el 2026-03-25 a las 23:00 America/Santiago, pueden volver a jugar a partir del **2026-04-24 00:00 America/Santiago**.

### 3.3 Cálculo canónico en TS

```ts
import { differenceInDays } from 'date-fns';

const daysSince = differenceInDays(asOfDate, lastPlayedOn);
return daysSince >= 30 ? { allowed: true } : { allowed: false, ... };
```

---

## 4. Límites semanales y mensuales (RN-04, RN-05)

### 4.1 Ventanas de conteo

- **Semana**: ISO-8601 (lunes 00:00 America/Santiago → domingo 23:59:59).
- **Mes**: calendario `America/Santiago` (1 del mes → último día 23:59:59).
- Se cuentan partidos con `status IN ('confirmado', 'empate', 'wo')` del mes/semana que incluye la fecha `asOfDate`.
- Partidos `type='campeonato'` **NO cuentan** para RN-04 (son excepción del reglamento).

### 4.2 Función `getMatchCounters` — contrato

```ts
function getMatchCounters(
  playerId: string,
  asOfDate: Date,
): Promise<{
  weekISO: number;     // matches escalerilla esta semana ISO
  monthCalendar: number; // matches escalerilla este mes
  challengesAcceptedThisMonth: number; // matches type='desafio' este mes
}>;
```

### 4.3 Casos

Asume hoy = `2026-04-24` (viernes, ISO week 17, abril).

| Partidos en DB | weekISO | monthCalendar | Interpretación |
|---|:---:|:---:|---|
| Ninguno | 0 | 0 | — |
| `type=sorteo, played_on=2026-04-21` (lunes) | 1 | 1 | mismo lunes |
| `type=sorteo, played_on=2026-04-14` (semana anterior) | 0 | 1 | — |
| `type=sorteo, played_on=2026-03-31` (mes anterior) | 0 | 0 | — |
| `type=campeonato, played_on=2026-04-21` | 0 | 0 | campeonatos no cuentan |
| 3 sorteos en la semana | 3 | 3 | alcanzó RN-04 semanal |

### 4.4 Elegibilidad para nuevo partido (`canAcceptNewMatch`)

```ts
function canAcceptNewMatch(
  playerId: string,
  type: 'sorteo' | 'desafio',
  proposedDate: Date,
): Promise<{ ok: true } | { ok: false; reason: string }>;
```

- Si `weekISO(proposedDate) >= 3` → rechaza.
- Si `monthCalendar(proposedDate) >= 4` → rechaza.
- Si `type='campeonato'` → siempre ok (no lo llamamos).

---

## 5. Freezes / Congelaciones (RN-09)

### 5.1 Función `canCreateFreeze` — contrato

```ts
function canCreateFreeze(
  playerId: string,
  weekId: string,
  season: Season,
  semester: 1 | 2,
): Promise<{ ok: true } | { ok: false; reason: 'max_freezes_semester' | 'already_frozen_that_week' }>;
```

### 5.2 Casos

- Si el jugador ya tiene 3 freezes en `(season, semester)` → rechaza.
- Si ya tiene un freeze para esa `weekId` → rechaza (unique constraint).
- Otherwise → ok.

### 5.3 Semestre

```ts
function getSemesterFromDate(d: Date): 1 | 2 {
  const m = d.getMonth(); // 0..11 en America/Santiago
  return m < 6 ? 1 : 2;
}
```

---

## 6. Penalizaciones por inactividad (RN-10) — aplicación única por umbral

### 6.1 Función `computeInactivityPenalties` — contrato

```ts
function computeInactivityPenalties(opts: {
  asOfDate: Date;
  players: Player[];
  hasPlayedInLast: (playerId: string, days: number) => Promise<boolean>;
  hasEventType: (playerId: string, reason: RankingEventReason, sinceDays: number) => Promise<boolean>;
  hasJustifiedInjuryActiveFreeze: (playerId: string) => Promise<boolean>;
  getCurrentPoints: (playerId: string) => Promise<number>;
}): Promise<RankingEventInsert[]>;
```

### 6.2 Reglas

1. **Mensual** (`inactivity_month`, -40 pts):
   - Se aplica si el jugador no tiene partidos (cualquier tipo, excepto campeonato... *actually: incluye campeonato, porque los campeonatos sí cuentan como actividad*) en los últimos 30 días corridos al `asOfDate`.
   - Se emite el **último día del mes calendario** o el próximo lunes hábil si el cron corre después.
   - **Idempotente**: no emitir si ya existe un `ranking_events` con `reason='inactivity_month'` para ese jugador en el mismo mes.
   - **No aplica** si el jugador tiene un freeze `reason='lesion'` activo en ese mes (lesión justificada).

2. **3 meses** (`inactivity_3mo`, -25%):
   - Se aplica cuando se cumplen exactamente 90 días sin partidos desde el último partido (o desde `initial_seed` si nunca jugó).
   - Snapshot: `delta = -round(0.25 * currentPoints)`.
   - Aplicación **única por umbral**: si ya existe un `inactivity_3mo` para el jugador sin un partido intermedio posterior, no se aplica de nuevo. Cualquier partido "resetea" el contador.

3. **6 meses** (`inactivity_6mo`, -50%):
   - Cuando se cumplen 180 días.
   - Snapshot: `delta = -round(0.50 * currentPoints)` (después del -25% ya aplicado).
   - Única por umbral con mismo criterio de reset.

4. **12 meses** (`inactivity_1y`, -100%):
   - Cuando se cumplen 365 días.
   - Snapshot: `delta = -currentPoints` (deja en 0).
   - Única por umbral.

5. **Exención por lesión justificada**:
   - Si el jugador tiene freeze `reason='lesion'` activo y ya consumió sus 3 semanas del semestre → el escalonado (25/50/100%) **NO aplica**.
   - El -40 mensual **SÍ aplica** (el reglamento lo dice explícitamente).

### 6.3 Casos

Asume hoy = `2026-06-30 23:59` America/Santiago, fin de mes.

| Jugador | Último partido | Freeze activo | Puntos actuales | Eventos esperados |
|---|---|---|---:|---|
| A | 2026-06-15 | no | 300 | (ninguno — jugó este mes) |
| B | 2026-05-20 | no | 300 | `inactivity_month` -40 |
| C | 2026-04-01 | no | 300 | `inactivity_month` -40 |
| D | 2026-03-30 (90 días) | no | 300 | `inactivity_month` -40, `inactivity_3mo` -75 |
| E | 2026-06-01 | freeze lesión semana 22 | 300 | (ninguno — lesionado) |
| F | 2025-12-31 (+180 días) | no | 400 | `inactivity_month` -40, `inactivity_6mo` -180 (50% de 360=puntos restantes tras -40 si aplica; orden: primero -40, luego %) |
| G | 2025-06-30 (+365 días) | no | 400 | `inactivity_month` -40, `inactivity_1y` -360 |

**Orden de aplicación dentro del mismo cron**: primero `inactivity_month`, luego el escalonado sobre los puntos resultantes.

### 6.4 Idempotencia (crítico)

Antes de insertar cualquier evento:

```ts
// Para inactivity_month: verifica que no haya ya uno en el mes calendar del asOfDate
const existsMonthly = await db.select().from(rankingEvents)
  .where(and(
    eq(rankingEvents.playerId, p.id),
    eq(rankingEvents.reason, 'inactivity_month'),
    gte(rankingEvents.occurredAt, startOfMonth(asOfDate)),
    lte(rankingEvents.occurredAt, endOfMonth(asOfDate)),
  ));
if (existsMonthly.length > 0) return; // skip
```

Para los escalonados (3mo/6mo/1y): verifica que no haya un evento del mismo tipo **desde el último partido del jugador**.

---

## 7. Zona desafiable ±5 puestos (RN-06)

### 7.1 Función `getChallengeableZone` — contrato

```ts
function getChallengeableZone(
  playerId: string,
  asOfDate: Date,
): Promise<{
  rank: number;           // posición actual (1-based)
  challengeable: Array<{
    player: Player;
    rank: number;
    canChallenge: boolean;    // respeta RN-03
    lastPlayedDaysAgo?: number;
  }>;
}>;
```

Lógica:

1. Obtener ranking de la **categoría del jugador** (M o F).
2. Encontrar su posición `r`.
3. Devolver jugadores en posiciones `[r-5, r-1] ∪ [r+1, r+5]`.
4. Para cada uno, marcar `canChallenge=true` si RN-03 permite.

### 7.2 Casos

Asume ranking M:

```
1. Juan (420)
2. Pedro (380)
3. Diego (350)
4. Mateo (300)
5. Sergio (250)
6. Tomás (240)
7. Felipe (230)
8. Rodrigo (220)
```

- Para `Felipe` (rank 7): zona `[2..6] ∪ [8]` = Pedro, Diego, Mateo, Sergio, Tomás, Rodrigo.
- Para `Juan` (rank 1): zona `[]` arriba + `[2..6]` = Pedro, Diego, Mateo, Sergio, Tomás.
- Para `Rodrigo` (rank 8, último): zona `[3..7]` arriba = Diego, Mateo, Sergio, Tomás, Felipe.

---

## 8. Algoritmo de propuesta de cruces (fixture)

### 8.1 Contrato

```ts
function proposeFixture(opts: {
  category: 'M' | 'F';
  weekId: string;
  asOfDate: Date;
  deps: {
    getAvailablePlayers: (category, weekId) => Promise<Array<Player & { maxMatches: number; currentPoints: number; }>>;
    getMatchCount: (playerId, asOfDate) => Promise<{ week: number; month: number }>;
    hasPlayedRecently: (a, b, asOfDate) => Promise<boolean>; // RN-03
  };
}): Promise<{
  proposedMatches: Array<{ player1Id: string; player2Id: string; }>;
  unpaired: Array<{ playerId: string; reason: string }>;
}>;
```

### 8.2 Pseudocódigo (greedy, minimizar |delta puntos|)

```
INPUT: availablePlayers, asOfDate
OUTPUT: proposedMatches[], unpaired[]

1. Para cada jugador p en availablePlayers:
     remainingCapacity[p] = min(p.maxMatches, 3 - weekCount(p), 4 - monthCount(p))
     si remainingCapacity[p] <= 0 → marcar como unpaired con reason='sin cupo', excluir

2. Ordenar availablePlayers por currentPoints descendente

3. proposedMatches = []
   usedCapacity = {p: 0 for p in availablePlayers}

4. Para i = 0 hasta len(availablePlayers)-1:
     playerA = availablePlayers[i]
     si usedCapacity[playerA] >= remainingCapacity[playerA]: continuar

     mejorCandidato = null
     mejorDiff = +infinito
     Para j = i+1 hasta len(availablePlayers)-1:
         playerB = availablePlayers[j]
         si usedCapacity[playerB] >= remainingCapacity[playerB]: continuar
         si hasPlayedRecently(playerA.id, playerB.id, asOfDate): continuar
         diff = |playerA.currentPoints - playerB.currentPoints|
         si diff < mejorDiff:
             mejorDiff = diff
             mejorCandidato = playerB

     si mejorCandidato existe:
         proposedMatches.push({player1Id: playerA.id, player2Id: mejorCandidato.id})
         usedCapacity[playerA] += 1
         usedCapacity[mejorCandidato] += 1

5. Para cada jugador p con usedCapacity[p] < remainingCapacity[p]:
     unpaired.push({playerId: p.id, reason: 'sin pareja elegible'})

6. Return {proposedMatches, unpaired}
```

### 8.3 Propiedades del algoritmo

- **Determinístico**: mismo input → mismo output. Si hay empate en `currentPoints`, se desempata por `fullName` ASC.
- **Respeta RN-03** (30 días).
- **Respeta RN-04** (cupos semanales y mensuales).
- **Respeta RN-05** (declaración de `maxMatches` del jugador).
- **NO busca matching óptimo global** (es greedy). Puede dejar unpaired cuando un matching perfecto existía.

### 8.4 Casos de prueba

**Caso 1**: 4 jugadores con puntos distintos, ninguno jugó entre sí.

```
availablePlayers: [
  {id: 'a', points: 400, maxMatches: 1},
  {id: 'b', points: 380, maxMatches: 1},
  {id: 'c', points: 300, maxMatches: 1},
  {id: 'd', points: 250, maxMatches: 1},
]

Esperado:
proposedMatches: [
  {player1Id: 'a', player2Id: 'b'},
  {player1Id: 'c', player2Id: 'd'},
]
unpaired: []
```

**Caso 2**: 3 jugadores (impar).

```
availablePlayers: [
  {id: 'a', points: 400, maxMatches: 1},
  {id: 'b', points: 380, maxMatches: 1},
  {id: 'c', points: 300, maxMatches: 1},
]

Esperado:
proposedMatches: [
  {player1Id: 'a', player2Id: 'b'},
]
unpaired: [
  {playerId: 'c', reason: 'sin pareja elegible'}
]
```

**Caso 3**: A y B jugaron hace 10 días.

```
availablePlayers: [a (400), b (380), c (300), d (250)]
hasPlayedRecently(a, b) = true

Esperado:
proposedMatches: [
  {p1: 'a', p2: 'c'},  // a no puede con b, salta a c
  // b queda sin a, busca el más cercano disponible → d
  {p1: 'b', p2: 'd'},
]
unpaired: []
```

**Caso 4**: Jugador con `maxMatches=2` debería emparejarse dos veces.

```
availablePlayers: [
  {id: 'a', points: 400, maxMatches: 2},
  {id: 'b', points: 380, maxMatches: 1},
  {id: 'c', points: 300, maxMatches: 1},
]

Esperado:
proposedMatches: [
  {p1: 'a', p2: 'b'},
  {p1: 'a', p2: 'c'},  // a vuelve a salir con remainingCapacity=1
]
unpaired: []
```

> **Nota crítica para el agente**: el algoritmo itera **una vez** por jugador ordenado. Si `maxMatches > 1`, puede requerir pasadas adicionales. Implementar como **loop externo que se repite mientras haya progreso**.

---

## 9. Desempate del ranking (RN-11)

### 9.1 Función `resolveTies` — contrato

```ts
function resolveTies(
  rows: Array<{ player: Player; points: number }>,
  asOfDate: Date,
  deps: {
    getHeadToHead: (a, b) => Promise<{ winsA: number; winsB: number }>;
    getSetDifferential: (playerId) => Promise<number>;
    getGameDifferential: (playerId) => Promise<number>;
  },
): Promise<Array<{ player: Player; points: number; rank: number }>>;
```

### 9.2 Algoritmo

```
1. Ordenar inicialmente por points DESC.
2. Agrupar filas con puntos iguales (grupos de empate).
3. Para cada grupo de tamaño ≥ 2:
   a. Calcular H2H entre cada par del grupo → ordenar por (winsA - lossesA) DESC.
   b. Si persisten subgrupos empatados dentro → aplicar sets-dif DESC.
   c. Si persisten → games-dif DESC.
   d. Si persisten → sorteo determinístico (orden alfabético fullName ASC).
4. Asignar ranks 1..N respetando orden final.
```

### 9.3 Casos

**Caso 1**: Sin empates.

```
Input: [A(400), B(380), C(350)]
Output: [A(rank 1), B(rank 2), C(rank 3)]
```

**Caso 2**: Empate 2 jugadores, H2H resuelve.

```
Input: [A(400), B(400)]
H2H: A ganó 2, B ganó 1 → A=+1, B=-1
Output: [A(rank 1), B(rank 2)]
```

**Caso 3**: Empate 3 jugadores, H2H + sets-dif.

```
Input: [A(400), B(400), C(400)]
H2H:
  A vs B: A=1, B=1
  A vs C: A=1, C=0
  B vs C: B=0, C=1
Diferencias: A=+1, B=0, C=0

Paso 1: A va primero.
Paso 2: B vs C empatados en H2H → sets-dif:
  B sets-dif = +3 (ej.)
  C sets-dif = +1
Output: [A(1), B(2), C(3)]
```

**Caso 4**: Empate absoluto → sorteo determinístico por nombre.

```
Input: [Pedro(400), Ana(400)]  (ambos H2H 0-0, sets iguales, games iguales)
Output: [Ana(1), Pedro(2)]  (alfabético ASC)
```

---

## 10. Flujo de reporte y confirmación de resultados (PD-09 — jugador reporta, admin confirma)

### 10.1 Estados de `matches.status`

```
pendiente  →  reportado  →  confirmado / wo / empate
                ↓ admin corrige                   ↑
                └──────── admin edita ────────────┘
```

### 10.2 Transiciones

| Desde | A | Quién | Efectos |
|---|---|---|---|
| `pendiente` | `reportado` | jugador | guarda `reportedById`, `reportedAt`, `format`, sets |
| `pendiente` | `confirmado` | admin | (atajo) guarda todo + aplica puntos |
| `pendiente` | `wo` | admin | guarda `woLoserId` + aplica -20 / +60 |
| `reportado` | `confirmado` | admin | aplica puntos, guarda `confirmedById`, `confirmedAt` |
| `reportado` | `reportado` | admin o jugador | edita datos, no aplica puntos aún |
| `confirmado` | `confirmado` | admin | edita → crea eventos compensatorios |

### 10.3 Aplicación de puntos (al pasar a `confirmado` / `empate` / `wo`)

1. Validar score con `isValidMatchScore`.
2. Calcular puntos con `calculateMatchPoints`.
3. Insertar `ranking_events` en transacción junto con el update de `matches`.
4. Registrar en `audit_log`.

### 10.4 Corrección de resultado ya confirmado

Nunca editamos `ranking_events` existentes. Flujo:

1. Calcular deltas anteriores (lo que ya se aplicó).
2. Insertar `ranking_events` con `reason='match_correction'` revirtiendo los deltas anteriores. `note` explica.
3. Calcular deltas nuevos y aplicarlos normalmente.
4. Actualizar `match_sets` con los nuevos scores (estos sí se editan).

---

## 11. Generación de texto de fixture para WhatsApp

### 11.1 Función `renderFixtureMessage` — contrato

```ts
function renderFixtureMessage(opts: {
  week: Week;
  matchesByCategory: {
    M: Array<{ player1Name: string; player2Name: string }>;
    F: Array<{ player1Name: string; player2Name: string }>;
  };
}): string;
```

### 11.2 Template exacto

```
🎾 FIXTURE ESCALERILLA · Semana {isoWeek} ({startDate_DMM} al {endDate_DMM})

SINGLES HOMBRES
• {p1} vs {p2}
• {p1} vs {p2}
...

SINGLES MUJERES
• {p1} vs {p2}
...

Coordinen día y hora por acá. Recuerden reportar el resultado en la app antes del domingo.
```

### 11.3 Reglas del template

- Fechas en formato `D MMM` español: `7 abr`, `13 abr`.
- Nombre del jugador: primer nombre + apellido abreviado si `full_name` es largo (regla opcional). Por ahora: `full_name` completo.
- Si una categoría está vacía, se **omite** su sección (no se muestra "SINGLES MUJERES" con cero partidos).
- Orden dentro de cada categoría: por `fullName` ASC del `player1`.
- Si no hay partidos en ninguna categoría: devolver `null` (la UI no muestra botón).

### 11.4 Ejemplo concreto

Input:

```ts
{
  week: { isoWeek: 17, startDate: '2026-04-20' },
  matchesByCategory: {
    M: [
      { player1Name: 'Diego Rojas', player2Name: 'Mateo López' },
      { player1Name: 'Juan Pérez', player2Name: 'Pedro García' },
    ],
    F: [
      { player1Name: 'Ana Silva', player2Name: 'María Torres' },
    ],
  },
}
```

Output:

```
🎾 FIXTURE ESCALERILLA · Semana 17 (20 abr al 26 abr)

SINGLES HOMBRES
• Diego Rojas vs Mateo López
• Juan Pérez vs Pedro García

SINGLES MUJERES
• Ana Silva vs María Torres

Coordinen día y hora por acá. Recuerden reportar el resultado en la app antes del domingo.
```

---

## 12. Bonus de campeonatos (RN-12)

### 12.1 Función `applyChampionshipBonuses` — contrato

```ts
function applyChampionshipBonuses(
  championshipId: string,
  placements: Array<{ playerId: string; placement: Placement }>,
): Promise<RankingEventInsert[]>;
```

Se llama cuando el admin "cierra" un campeonato registrando el podio completo.

### 12.2 Tabla de bonus

| Placement | kind='regular' | kind='clausura' |
|---|---:|---:|
| `campeon` | +150 | +300 |
| `finalista` | +75 | +150 |
| `semifinalista` | +50 | +75 |
| `cuartofinalista` | +25 | +35 |

### 12.3 Idempotencia

- Antes de insertar, verificar que no existan ya eventos `reason='championship_bonus'` con `refId=championshipId` para ese jugador.
- Si ya existen (el admin cerró antes y reabre), **no se duplican**.

### 12.4 Partidos individuales

Los partidos dentro del campeonato (`matches.type='campeonato'`, `matches.championshipId` no null) generan sus propios eventos por resultado (RN-01) **además** del bonus. Los dos flujos son independientes.

---

## 13. Lista de archivos de test que los agentes deben crear

- `lib/rules/score.test.ts` — cubre §1, §2.
- `lib/rules/rivalry.test.ts` — cubre §3.
- `lib/rules/limits.test.ts` — cubre §4.
- `lib/rules/freezes.test.ts` — cubre §5.
- `lib/rules/inactivity.test.ts` — cubre §6 (crítico: 20+ casos).
- `lib/rules/challenges.test.ts` — cubre §7.
- `lib/fixture/propose.test.ts` — cubre §8.
- `lib/ranking/tiebreakers.test.ts` — cubre §9.
- `lib/matches/lifecycle.test.ts` — cubre §10.
- `lib/fixture/message.test.ts` — cubre §11.
- `lib/rules/championships.test.ts` — cubre §12.

**Cobertura mínima**: 90% en `lib/rules/*` y `lib/fixture/*`. Esto es un piso, no un objetivo.
