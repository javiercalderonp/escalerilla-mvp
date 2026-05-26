# Milestone 8 — Perfil enriquecido, identidad ATP y navegación temporal

> Detalle ejecutable histórico del M8. La entrada corta y el estado vigente viven en `docs/TASKS.md`.

**Objetivo**: que la app deje de sentirse "MVP funcional" y se convierta en una experiencia tipo mini-ATP: identidad visual de torneo, perfiles ricos accesibles desde modal, onboarding bloqueante con datos personales y deportivos, y navegación entre semanas pasadas/futuras del fixture.

**Estado 2026-05-26**: implementado en su mayor parte. El código actual incluye perfil enriquecido, validaciones, onboarding con disponibilidad general, componentes visuales, ranking renovado, fixture con navegación temporal y tests de validación. Queda como pendiente de cierre la verificación final lint/test/build/mobile y ajustes finos según producción.

**No entra en M8** (queda para M9): foto upload (Vercel Blob), página `/historial` con filtros, tab "Evolución" (sparkline), bio/club/estilo (paso 3 onboarding), bottom tab bar mobile, snowflake inactividad, dark mode auditado, toggles de privacidad por campo, search global.

---

## Decisiones de producto (referencia ADR)

- **ADR-027** — Paleta ATP-inspired (court azul + grass + clay + gold/silver/bronze) reemplaza emerald/yellow/slate.
- **ADR-028** — Click en fila del ranking abre `PlayerCardModal` (sheet en mobile, dialog desktop) y reemplaza la página `/ranking/[cat]/[playerId]`.
- Privacidad: `phone` público a logueados, `rut` solo admin, `birthDate` privado.
- Avatar: solo iniciales en M8, sin upload.
- Nivel: auto-declarado, editable por admin.
- Onboarding: bloqueante de 2 pasos hasta completar el set obligatorio.

## Set obligatorio (gating onboarding)

`firstName`, `lastName`, `gender`, `birthDate`, `phone`, `rut`, `level`, `dominantHand`, `backhand`, `joinedLadderOn`. Si cualquiera está null en el `Player` asociado al `User` autenticado, el helper `requireCompleteProfile()` redirige a `/onboarding`.

---

## Checklist (formato repo)

- [x] 🔴 **E0** Schema: enums + columnas + migración aditiva en `players`
- [x] 🔴 **E0** Backfill `firstName`/`lastName`/`joinedLadderOn`/`visibility`
- [x] 🔴 **E1** `lib/validation/rut.ts` (módulo 11) con tests
- [x] 🔴 **E1** `lib/validation/phone.ts` (E.164 chileno) con tests
- [x] 🔴 **E1** Schemas Zod onboarding (identidad, tenis, disponibilidad)
- [x] 🔴 **E2** Tokens visuales en `globals.css`
- [x] 🔴 **E2** Componentes UI: `Avatar`, `Badge`, `Tabs`, `Skeleton`, `EmptyState`, `WeekStepper`, `StreakDots`
- [x] 🔴 **E3** Helper `isProfileComplete` y `requireCompleteProfile`
- [x] 🔴 **E3** Página `/onboarding` bloqueante
- [x] 🔴 **E3** Server action de onboarding con manejo de RUT duplicado
- [x] 🔴 **E4** Helper `getPlayerCardData` con visibility
- [x] 🔴 **E4** `PlayerCardModal` (tabs Info + Rendimiento)
- [x] 🔴 **E4** Link de perfil/modal desde ranking
- [x] 🔴 **E5** Refactor `ranking-table` a tokens, top-3 destacado, click a perfil/modal
- [x] 🟡 **E5** Control de categoría
- [x] 🔴 **E6** WeekStepper en `/fixture` con navegación de semanas publicadas
- [x] 🟡 **E7** Edición de `level` en `/admin/jugadores`
- [x] 🟡 **E8** Header con paleta actual
- [ ] 🔴 **E9** `npm run lint && typecheck && test && build` en verde
- [ ] 🔴 **E9** Verificación manual mobile 375px (checklist abajo)

---

## Pre-requisitos

```bash
cd /Users/javiercalderon/Documents/escalerilla-mvp
git checkout claw && git pull
git checkout -b feat/m8-rediseno-mvp
npm install
npm run dev   # confirmar que arranca antes de tocar nada
```

Comandos del repo (verificar en `package.json`): `dev`, `build`, `lint`, `test`, `db:generate`, `db:migrate` (o `drizzle-kit push`).

## Convenciones obligatorias

- TypeScript estricto, cero `any` salvo en boundaries documentados.
- Sin `// eslint-disable` ni `// @ts-ignore` salvo justificación inline.
- Componentes UI en `src/components/ui/<kebab>.tsx`, CVA para variantes (patrón ya usado en `button.tsx`).
- Server Actions cerca del consumidor, validar con Zod antes de tocar DB.
- Tests Vitest en `tests/<carpeta>/<archivo>.test.ts`, los 26 tests existentes deben seguir verdes.
- Format final con `npx biome format --write .`.
- Mobile reference: 375px (UX_SPEC §1).

---

## Etapa 0 — Schema y migración

Bloquea todo lo demás.

### T0.1 Enums y columnas en `players`

Archivo: `src/lib/db/schema.ts`. En el código actual el schema ejecutable vive ahí; las instrucciones de abajo quedan como referencia histórica de implementación.

```ts
export const playerLevelEnum = pgEnum('player_level', [
  'principiante', 'intermedio_bajo', 'intermedio_alto', 'avanzado',
]);
export const dominantHandEnum = pgEnum('dominant_hand', ['diestro', 'zurdo']);
export const backhandEnum = pgEnum('backhand', ['una_mano', 'dos_manos']);
export const playFrequencyEnum = pgEnum('play_frequency', [
  '1-2_semana', '3-4_semana', '5+_semana',
]);

export type PlayerVisibility = {
  phone: 'public' | 'players' | 'private';
  rut: 'admin' | 'private';
  birthDate: 'public' | 'players' | 'private';
};

export const DEFAULT_VISIBILITY: PlayerVisibility = {
  phone: 'players',
  rut: 'admin',
  birthDate: 'private',
};
```

Extender `playersTable` con columnas (todas nullable hasta T0.3):

| Columna | Tipo | Post-backfill | Notas |
|---|---|---|---|
| `first_name` | `text` | NOT NULL | derivado de `full_name` |
| `last_name` | `text` | NOT NULL | derivado de `full_name` |
| `birth_date` | `date` | nullable en DB | obligatorio en validación |
| `phone` | `text` | nullable en DB | obligatorio en validación |
| `rut` | `text` UNIQUE | nullable en DB | obligatorio en validación |
| `joined_ladder_on` | `date` | NOT NULL | default `created_at::date` |
| `level` | `player_level` | nullable en DB | obligatorio en validación |
| `dominant_hand` | `dominant_hand` | nullable en DB | obligatorio en validación |
| `backhand` | `backhand` | nullable en DB | obligatorio en validación |
| `play_frequency` | `play_frequency` | nullable | M9 |
| `visibility` | `jsonb` | NOT NULL | default `DEFAULT_VISIBILITY` |

Índices: `unique` en `rut` (vía `.unique()`), índice en `level`.

### T0.2 Generar migración

```bash
npm run db:generate   # nombre real según package.json
```

Verificar SQL generado: solo `CREATE TYPE` para los 4 enums y `ALTER TABLE players ADD COLUMN`. Sin `DROP`. Sin `ALTER` sobre columnas existentes. Si toca columnas existentes → detenerse y reportar.

### T0.3 Migración manual de backfill

Archivo `drizzle/<NNNN>_player_profile_backfill.sql`:

```sql
UPDATE players
SET
  first_name = SPLIT_PART(full_name, ' ', 1),
  last_name = NULLIF(TRIM(SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)), '')
WHERE first_name IS NULL;

UPDATE players SET last_name = full_name WHERE last_name IS NULL OR last_name = '';
UPDATE players SET joined_ladder_on = created_at::date WHERE joined_ladder_on IS NULL;
UPDATE players SET visibility = '{"phone":"players","rut":"admin","birthDate":"private"}'::jsonb WHERE visibility IS NULL;

ALTER TABLE players
  ALTER COLUMN first_name SET NOT NULL,
  ALTER COLUMN last_name SET NOT NULL,
  ALTER COLUMN joined_ladder_on SET NOT NULL,
  ALTER COLUMN visibility SET NOT NULL;
```

Aplicar con `npm run db:migrate`.

**Acceptance E0**: `SELECT COUNT(*) FROM players WHERE first_name IS NULL OR last_name IS NULL OR joined_ladder_on IS NULL OR visibility IS NULL;` = 0.

**Commit E0**: `feat(db): extend players schema with profile fields and enums (M8)`

---

## Etapa 1 — Validaciones

### T1.1 RUT chileno

Archivo: `src/lib/validation/rut.ts`.

```ts
import { z } from 'zod';

export function cleanRut(input: string): string {
  return input.replace(/[.\s-]/g, '').toUpperCase();
}

export function formatRut(input: string): string {
  const c = cleanRut(input);
  if (c.length < 2) return c;
  return `${c.slice(0, -1)}-${c.slice(-1)}`;
}

export function isValidRut(input: string): boolean {
  const c = cleanRut(input);
  if (!/^\d{7,8}[0-9K]$/.test(c)) return false;
  const body = c.slice(0, -1);
  const dv = c.slice(-1);
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const res = 11 - (sum % 11);
  const expected = res === 11 ? '0' : res === 10 ? 'K' : String(res);
  return expected === dv;
}

export const rutSchema = z
  .string()
  .min(1, 'RUT requerido')
  .transform(formatRut)
  .refine(isValidRut, 'RUT inválido');
```

Tests `tests/validation/rut.test.ts`: válidos conocidos (calcular DV con `isValidRut` antes de hardcodear), inválidos por DV, formato sucio (`12.345.678-K`), vacío, K minúscula. Cubrir también `cleanRut` y `formatRut` en isolation.

### T1.2 Teléfono CL E.164

Archivo: `src/lib/validation/phone.ts`.

```ts
import { z } from 'zod';

export function cleanPhone(input: string): string {
  return input.replace(/[\s().-]/g, '');
}

export function normalizePhone(input: string): string {
  const c = cleanPhone(input);
  if (c.startsWith('+569') && c.length === 12) return c;
  if (c.startsWith('569') && c.length === 11) return `+${c}`;
  if (c.startsWith('9') && c.length === 9) return `+56${c}`;
  return c;
}

export const phoneSchema = z
  .string()
  .min(1, 'Teléfono requerido')
  .transform(normalizePhone)
  .refine((v) => /^\+569\d{8}$/.test(v), 'Teléfono móvil chileno inválido (+569XXXXXXXX)');

export function whatsappUrl(phone: string): string {
  return `https://wa.me/${phone.replace('+', '')}`;
}
```

Tests `tests/validation/phone.test.ts`: `+56912345678`, `912345678`, `56912345678`, `9 1234 5678` (válidos); `+1234567890`, `+5621234567` (fijos chilenos rechazados en M8), `123` (inválidos).

### T1.3 Schemas Zod de onboarding

Archivo: `src/lib/validation/player.ts` (extender, no reemplazar el existente).

```ts
import { z } from 'zod';
import { rutSchema } from './rut';
import { phoneSchema } from './phone';

const NAME_REGEX = /^[A-Za-zÁÉÍÓÚÑáéíóúñ' -]+$/;

export const onboardingStep1Schema = z.object({
  firstName: z.string().min(2).max(60).regex(NAME_REGEX, 'Solo letras'),
  lastName: z.string().min(2).max(60).regex(NAME_REGEX, 'Solo letras'),
  gender: z.enum(['M', 'F']),
  birthDate: z.coerce.date().refine((d) => {
    const age = (Date.now() - d.getTime()) / 31557600000;
    return age >= 14 && age <= 90;
  }, 'Edad debe estar entre 14 y 90'),
  phone: phoneSchema,
  rut: rutSchema,
});

export const onboardingStep2Schema = z.object({
  level: z.enum(['principiante', 'intermedio_bajo', 'intermedio_alto', 'avanzado']),
  dominantHand: z.enum(['diestro', 'zurdo']),
  backhand: z.enum(['una_mano', 'dos_manos']),
});

export const onboardingFullSchema = onboardingStep1Schema.merge(onboardingStep2Schema);
export type OnboardingStep1 = z.infer<typeof onboardingStep1Schema>;
export type OnboardingStep2 = z.infer<typeof onboardingStep2Schema>;
export type OnboardingFull = z.infer<typeof onboardingFullSchema>;
```

**Commit E1**: `feat(validation): RUT, phone CL and onboarding schemas (M8)`

---

## Etapa 2 — Design system

### T2.1 Paleta en `globals.css`

Archivo: `src/app/globals.css`. Agregar tokens al `:root` y `.dark`, exponer en `@theme inline`:

```css
:root {
  --court: oklch(0.32 0.08 250);
  --court-foreground: oklch(0.98 0 0);
  --grass: oklch(0.55 0.14 145);
  --grass-foreground: oklch(0.98 0 0);
  --clay: oklch(0.62 0.16 50);
  --clay-foreground: oklch(0.98 0 0);
  --gold: oklch(0.78 0.13 85);
  --silver: oklch(0.78 0.02 250);
  --bronze: oklch(0.62 0.10 50);
  --primary: var(--court);
  --primary-foreground: var(--court-foreground);
  --ring: var(--court);
}

.dark {
  --court: oklch(0.72 0.14 250);
  --court-foreground: oklch(0.18 0.02 250);
  --grass: oklch(0.65 0.16 145);
  --clay: oklch(0.70 0.16 50);
  --gold: oklch(0.82 0.13 85);
}

@theme inline {
  --color-court: var(--court);
  --color-court-foreground: var(--court-foreground);
  --color-grass: var(--grass);
  --color-grass-foreground: var(--grass-foreground);
  --color-clay: var(--clay);
  --color-clay-foreground: var(--clay-foreground);
  --color-gold: var(--gold);
  --color-silver: var(--silver);
  --color-bronze: var(--bronze);
}

.tabular-nums { font-variant-numeric: tabular-nums; }
```

### T2.2 — `Avatar` (`src/components/ui/avatar.tsx`)

API: `{ firstName?: string; lastName?: string; size?: 'xs'|'sm'|'md'|'lg'|'xl'; className?: string }`.

Render: `<span>` redondo con `bg-court text-court-foreground font-bold tracking-tight inline-flex items-center justify-center`. Iniciales `(firstName[0] + lastName[0]).toUpperCase()`. Si solo hay `firstName`, una letra. Si ambos vacíos, render `?`.

Sizes: `xs` 24px text-[10px], `sm` 32px text-xs, `md` 40px text-sm, `lg` 56px text-base, `xl` 96px text-2xl.

### T2.3 — `Badge` (`src/components/ui/badge.tsx`)

CVA con variantes y helper:

```ts
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
  {
    variants: {
      variant: {
        default: 'bg-muted text-foreground',
        court: 'bg-court text-court-foreground',
        grass: 'bg-grass text-grass-foreground',
        clay: 'bg-clay text-clay-foreground',
        gold: 'bg-gold text-foreground',
        outline: 'border border-border text-foreground',
        success: 'bg-grass/15 text-grass border border-grass/30',
        warning: 'bg-clay/15 text-clay border border-clay/30',
        muted: 'bg-muted text-muted-foreground',
      },
      size: {
        sm: 'text-[10px] px-1.5 py-0',
        md: 'text-xs px-2 py-0.5',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  }
);

export function levelBadgeProps(level: PlayerLevel | null | undefined) {
  if (!level) return null;
  const map = {
    principiante: { variant: 'muted' as const, label: 'Principiante' },
    intermedio_bajo: { variant: 'outline' as const, label: 'Intermedio bajo' },
    intermedio_alto: { variant: 'court' as const, label: 'Intermedio alto' },
    avanzado: { variant: 'gold' as const, label: 'Avanzado' },
  };
  return map[level];
}
```

### T2.4 — `Tabs` (`src/components/ui/tabs.tsx`)

Sobre Base UI Tabs si el package lo expone; si no, implementación con state local + `role="tablist"`. API: `<Tabs defaultValue="info"><TabsList><TabsTrigger value="info">Info</TabsTrigger>...</TabsList><TabsContent value="info">...</TabsContent></Tabs>`. Soporte de teclado: ←/→ cambia tab, Home/End van al primero/último, Tab cicla normalmente.

### T2.5 — `Skeleton` (`src/components/ui/skeleton.tsx`)

```tsx
import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />;
}
```

### T2.6 — `EmptyState` (`src/components/ui/empty-state.tsx`)

API: `{ icon: LucideIcon; title: string; description?: string; action?: ReactNode }`. Render centrado con padding generoso, ícono opcional 48px en `text-muted-foreground`.

### T2.7 — `WeekStepper` (`src/components/ui/week-stepper.tsx`)

Server-friendly (sin hooks). API:

```ts
type WeekStepperProps = {
  currentWeek: { id: string; startsOn: Date | string; endsOn: Date | string; label?: string };
  prevWeekId?: string | null;
  nextWeekId?: string | null;
  hrefBuilder: (weekId: string) => string;
  isCurrent?: boolean;
};
```

Render: `[‹]  Semana N · 24-30 mar  [Esta semana]  [›]` (botones `<Link>` o `<button aria-disabled>` cuando `null`). Formato de fechas con `date-fns` y locale `es`.

### T2.8 — `StreakDots` (`src/components/ui/streak-dots.tsx`)

API: `{ results: Array<'W' | 'L'>; className?: string }`. Render flex gap-1, 8px round dots: `bg-grass` (W) / `bg-destructive` (L). `title` nativo con resumen (`"Últimos 5: W-W-L-W-W"`).

**Commit E2**: `feat(ui): design system tokens and primitives (M8)`

---

## Etapa 3 — Onboarding bloqueante

### T3.1 Helper de completitud

Archivo: `src/lib/players/profile-completeness.ts`.

```ts
import type { Player } from '@/lib/db/schema';

const REQUIRED_FIELDS = [
  'firstName', 'lastName', 'birthDate', 'phone', 'rut',
  'level', 'dominantHand', 'backhand', 'joinedLadderOn',
] as const;

export function isProfileComplete(p: Player | null | undefined): boolean {
  if (!p) return false;
  return REQUIRED_FIELDS.every((f) => p[f] != null && p[f] !== '');
}
```

Test `tests/players/profile-completeness.test.ts`: null → false, missing firstName → false, todos presentes → true.

### T3.2 Guard

Archivo: `src/lib/auth/require-complete-profile.ts`.

```ts
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { players, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { isProfileComplete } from '@/lib/players/profile-completeness';

export async function requireCompleteProfile() {
  const session = await auth();
  if (!session?.user?.email) redirect('/api/auth/signin');

  const [user] = await db.select().from(users).where(eq(users.email, session.user.email));
  if (!user) redirect('/onboarding');
  if (!user.playerId) redirect('/onboarding');

  const [player] = await db.select().from(players).where(eq(players.id, user.playerId));
  if (!isProfileComplete(player)) redirect('/onboarding');

  return { user, player };
}
```

Llamar al inicio de las pages autenticadas no-admin: `src/app/ranking/[categoria]/page.tsx`, `src/app/fixture/page.tsx`, `src/app/mi-perfil/page.tsx`, `src/app/disponibilidad/page.tsx`. **NO aplicar** en `src/app/admin/*` ni `src/app/onboarding/*`.

### T3.3 `/onboarding`

Archivos:
- `src/app/onboarding/page.tsx` — server component; valida sesión; si perfil ya completo, redirige a `/ranking/M`.
- `src/app/onboarding/onboarding-wizard.tsx` — client; state local; barra de progreso "Paso 1 de 2".
- `src/app/onboarding/actions.ts` — server actions.

**Paso 1 — Identidad**:
- `firstName`, `lastName` (text)
- `gender` (segmented control "Hombres" / "Mujeres" → valores `'M'` / `'F'`)
- `birthDate` (input date, max = hoy − 14 años)
- `phone` (text, placeholder `+56 9 1234 5678`)
- `rut` (text, placeholder `12.345.678-5`)

Al click en "Siguiente": `onboardingStep1Schema.safeParse(values)`, mostrar errores inline en cada campo, no avanzar si hay errores.

**Paso 2 — Tenis**:
- `level` (4 cards visuales seleccionables, grilla 1col mobile / 2col desktop)
- `dominantHand` (toggle 2 botones: Diestro / Zurdo)
- `backhand` (toggle: Una mano / Dos manos)

Al click en "Guardar": `onboardingStep2Schema.safeParse`, luego `submitOnboarding(...)`.

**Server action `submitOnboarding(input)`**:

```ts
'use server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { players, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { onboardingFullSchema } from '@/lib/validation/player';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function submitOnboarding(input: unknown) {
  const session = await auth();
  if (!session?.user?.email) throw new Error('No autenticado');
  const data = onboardingFullSchema.parse(input);

  const [user] = await db.select().from(users).where(eq(users.email, session.user.email));
  if (!user) throw new Error('Usuario no existe');

  const fullName = `${data.firstName} ${data.lastName}`;
  const today = new Date().toISOString().slice(0, 10);
  const birthDate = data.birthDate.toISOString().slice(0, 10);

  try {
    if (!user.playerId) {
      const [created] = await db.insert(players).values({
        fullName,
        firstName: data.firstName,
        lastName: data.lastName,
        gender: data.gender,
        birthDate,
        phone: data.phone,
        rut: data.rut,
        level: data.level,
        dominantHand: data.dominantHand,
        backhand: data.backhand,
        joinedLadderOn: today,
      }).returning();
      await db.update(users).set({ playerId: created.id, role: 'player' }).where(eq(users.id, user.id));
    } else {
      await db.update(players).set({
        fullName,
        firstName: data.firstName,
        lastName: data.lastName,
        gender: data.gender,
        birthDate,
        phone: data.phone,
        rut: data.rut,
        level: data.level,
        dominantHand: data.dominantHand,
        backhand: data.backhand,
      }).where(eq(players.id, user.playerId));
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('players_rut_unique')) {
      return { error: 'rut_taken' as const };
    }
    throw err;
  }

  revalidatePath('/ranking');
  redirect('/ranking/M');
}
```

**Acceptance E3**:
1. Login con cuenta sin Player → `/onboarding`.
2. Submit paso 1 con RUT inválido → error inline.
3. Phone `912345678` → normaliza a `+56912345678`.
4. Submit completo → crea Player, `users.role='player'`, redirige a `/ranking/M`.
5. `/onboarding` con perfil completo → redirige a `/ranking/M`.
6. `/ranking/M` con perfil incompleto → redirige a `/onboarding`.

**Commit E3**: `feat(onboarding): blocking 2-step wizard with RUT/phone validation (M8)`

---

## Etapa 4 — Player Card Modal

### T4.1 Helper de datos

Archivo: `src/lib/players/get-player-card-data.ts`.

```ts
type PlayerCardData = {
  player: {
    id: string;
    firstName: string;
    lastName: string;
    gender: 'M' | 'F';
    level: PlayerLevel | null;
    dominantHand: DominantHand | null;
    backhand: Backhand | null;
    joinedLadderOn: string | null;
    birthDate: string | null;   // null si viewer no tiene permiso
    age: number | null;
    phone: string | null;       // null si viewer no tiene permiso
    rut: string | null;         // null si viewer no es admin
    status: PlayerStatus;
  };
  ranking: { position: number; points: number; deltaWeek: number };
  performance: {
    matchesPlayed: number;
    matchesWon: number;
    matchesLost: number;
    winRate: number; // 0-100
    streak: Array<'W' | 'L'>;
  };
  recentMatches: Array<{
    id: string;
    opponentName: string;
    opponentId: string;
    score: string;
    result: 'W' | 'L' | 'WO_W' | 'WO_L' | 'D';
    playedOn: string;
  }>;
};

export async function getPlayerCardData(
  playerId: string,
  viewerRole: 'admin' | 'player' | 'guest',
  viewerPlayerId?: string,
): Promise<PlayerCardData> { /* ... */ }
```

**Reglas de visibility** (lee `player.visibility`):
- `phone`: `'public'` → todos; `'players'` → `viewerRole !== 'guest'`; `'private'` → solo dueño + admin.
- `rut`: solo si `viewerRole === 'admin'`.
- `birthDate` y `age`: misma lógica que `phone`.

**Queries**:
- Reusar query de ranking actual (ver `src/app/ranking/[categoria]/page.tsx`); si no hay helper, crear `src/lib/ranking/get-position.ts`.
- `recentMatches`: query a `matches` con `(player1Id = id OR player2Id = id) AND status IN ('confirmado','wo','empate')`, `ORDER BY playedOn DESC LIMIT 5`. JOIN `match_sets` para construir score (`"6-4 6-3"`). Para `wo` mostrar `"WO"`.
- `streak`: derivado de `recentMatches` (5 elementos).
- `deltaWeek`: sumar `rankingEvents.delta` con `createdAt >= startOfCurrentWeek` para ese player.

### T4.2 Componente modal

Archivo: `src/components/players/player-card-modal.tsx`. Client component.

Estructura:

```tsx
<Dialog open={open} onOpenChange={onClose}>
  <DialogContent className="p-0 sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto bottom-0 sm:bottom-auto">
    <header className="flex items-center gap-3 p-4 border-b">
      <Avatar firstName={p.firstName} lastName={p.lastName} size="lg" />
      <div className="flex-1 min-w-0">
        <h2 className="text-lg font-semibold tracking-tight truncate">
          {p.firstName} {p.lastName}
        </h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums">#{ranking.position}</span>
          <span>·</span>
          <span>{p.gender === 'M' ? 'Hombres' : 'Mujeres'}</span>
          {levelBadgeProps(p.level) && <Badge {...levelBadgeProps(p.level)!} />}
        </div>
      </div>
    </header>

    <Tabs defaultValue="info">
      <TabsList className="px-4 pt-2">
        <TabsTrigger value="info">Info</TabsTrigger>
        <TabsTrigger value="performance">Rendimiento</TabsTrigger>
      </TabsList>

      <TabsContent value="info" className="p-4 space-y-3">
        {p.age != null && <InfoRow icon={Calendar} label="Edad" value={`${p.age} años`} />}
        <InfoRow icon={Hand} label="Mano" value={p.dominantHand === 'diestro' ? 'Diestro' : 'Zurdo'} />
        <InfoRow icon={Activity} label="Revés" value={p.backhand === 'una_mano' ? 'Una mano' : 'Dos manos'} />
        {p.joinedLadderOn && <InfoRow icon={Trophy} label="En la escalerilla desde" value={formatDate(p.joinedLadderOn)} />}
        {p.phone && (
          <a href={whatsappUrl(p.phone)} target="_blank" rel="noopener" className="...">
            <MessageCircle /> WhatsApp
          </a>
        )}
        {p.rut && <InfoRow icon={IdCard} label="RUT" value={p.rut} />}
      </TabsContent>

      <TabsContent value="performance" className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Jugados" value={performance.matchesPlayed} />
          <Stat label="Ganados" value={performance.matchesWon} tone="grass" />
          <Stat label="% Win" value={`${performance.winRate.toFixed(0)}%`} />
        </div>
        <StreakDots results={performance.streak} />
        <ul className="space-y-2">
          {recentMatches.map((m) => <RecentMatchRow key={m.id} match={m} />)}
        </ul>
      </TabsContent>
    </Tabs>
  </DialogContent>
</Dialog>
```

Mobile: bottom sheet (`rounded-t-2xl bottom-0`); desktop: `sm:rounded-2xl sm:max-w-md` centrado. Esc cierra (Base UI Dialog default), click backdrop cierra.

### T4.3 Wrapper deep-link

Archivo: `src/components/players/player-card-modal-link.tsx`. Client component.

Lee `?player=<id>` con `useSearchParams`, fetch via server action `getPlayerCardDataAction(id)`, abre modal. Al cerrar, `router.replace(pathname)` para limpiar el query param sin recargar.

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { PlayerCardModal } from './player-card-modal';
import { getPlayerCardDataAction } from './actions';

export function PlayerCardModalLink() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const playerId = sp.get('player');
  const [data, setData] = useState<PlayerCardData | null>(null);

  useEffect(() => {
    if (!playerId) { setData(null); return; }
    getPlayerCardDataAction(playerId).then(setData);
  }, [playerId]);

  if (!playerId || !data) return null;
  return <PlayerCardModal data={data} open onClose={() => router.replace(pathname)} />;
}
```

`getPlayerCardDataAction(id)`: server action que resuelve `viewerRole` desde `auth()` y delega a `getPlayerCardData`.

**Commit E4**: `feat(players): player card modal with privacy-aware data (M8)`

---

## Etapa 5 — Ranking refactor

### T5.1 `ranking-table.tsx`

Archivo: `src/components/ranking/ranking-table.tsx`.

Cambios obligatorios:
1. Reemplazar todos los `bg-slate-*`, `text-slate-*` por tokens (`bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`).
2. Aplicar `tabular-nums` en posición, puntos, delta.
3. Columna de delta de puntos: `> 0 → <TrendingUp className="text-grass" />` + número, `< 0 → <TrendingDown className="text-destructive" />`, `= 0 → "—"`.
4. Avatar `sm` + nombre formato `Juan P.` (firstName + apellido inicial). Badge nivel a la derecha si existe.
5. Top-3: borde-l 3px → `border-l-gold` (#1), `border-l-silver` (#2), `border-l-bronze` (#3).
6. Click en fila: `<Link href={`${pathname}?player=${id}`} scroll={false}>` (en lugar de navegar a `/ranking/[cat]/[playerId]`).
7. Filas: `h-14 sm:h-12` (56px mobile, 48px desktop). Hover `bg-muted/50`.
8. Columnas opcionales (`racha`, `% victorias`, `Δ semana`) con `hidden sm:table-cell`.

Insertar `<PlayerCardModalLink />` al final de `src/app/ranking/[categoria]/page.tsx`.

### T5.2 Segmented control de categoría

Reemplazar tabs M/F actuales con dos botones pill: activo `bg-court text-court-foreground`, inactivo `bg-muted hover:bg-muted/80`. Mantener URLs `/ranking/M` y `/ranking/F`.

**Acceptance E5**:
1. `/ranking/M` carga sin errores con paleta nueva.
2. Click en fila abre `PlayerCardModal` sin perder scroll.
3. Top-3 visualmente destacado.
4. En móvil 375px no hay scroll horizontal.

**Commit E5**: `feat(ranking): redesigned table with player card modal trigger (M8)`

---

## Etapa 6 — Fixture con WeekStepper

### T6.1 Refactor `src/app/fixture/page.tsx`

1. Aceptar `searchParams: { week?: string }`.
2. Sin `week`: cargar la semana actual (lógica existente: la más reciente con matches).
3. Con `week`: cargar esa semana exacta. Filtrar para no-admin: semanas con fixture publicado/cerradas según la lógica actual del código. Si la semana navegada no califica para ese viewer, redirigir a `/fixture` con mensaje.
4. Calcular `prevWeekId`/`nextWeekId`:

```ts
const prev = await db.select({ id: weeks.id })
  .from(weeks)
  .where(and(
    eq(weeks.seasonId, currentWeek.seasonId),
    lt(weeks.startsOn, currentWeek.startsOn),
    inArray(weeks.status, ['cerrada']),
  ))
  .orderBy(desc(weeks.startsOn))
  .limit(1);

const next = await db.select({ id: weeks.id })
  .from(weeks)
  .where(and(
    eq(weeks.seasonId, currentWeek.seasonId),
    gt(weeks.startsOn, currentWeek.startsOn),
    inArray(weeks.status, ['cerrada']),
  ))
  .orderBy(asc(weeks.startsOn))
  .limit(1);
```

5. Renderizar `<WeekStepper currentWeek={...} prevWeekId={prev[0]?.id} nextWeekId={next[0]?.id} hrefBuilder={(id) => `/fixture?week=${id}`} isCurrent={...} />` arriba del listado.
6. Si la semana es `'cerrada'`: mostrar matches con resultados, ocultar acciones de reportar.
7. Sin matches: `<EmptyState icon={Calendar} title="Sin partidos" description="Esta semana no tiene fixture publicado." />`.

**Acceptance E6**:
1. `/fixture` muestra la semana actual con stepper.
2. `<` lleva a la semana anterior con resultados visibles.
3. `>` deshabilitado si no hay siguiente.
4. Refresh con `?week=<id>` mantiene contexto.

**Commit E6**: `feat(fixture): week navigation with stepper and read-only past weeks (M8)`

---

## Etapa 7 — Admin: nivel editable

### T7.1 Columna `level` en `/admin/jugadores`

Archivo principal: `src/app/admin/jugadores/page.tsx` (y client components asociados).

Agregar columna "Nivel" entre "Puntos iniciales" y "Estado". Render: `<Badge {...levelBadgeProps(player.level)!} />` o `"—"` si null.

### T7.2 Edición

**Opción A** (preferida si existe form): agregar campo "Nivel" (`<Select>`) en el form de edición existente.

**Opción B** (inline): `<Select>` por fila con server action.

```ts
'use server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { players } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function updatePlayerLevel(playerId: string, level: PlayerLevel | null) {
  const session = await auth();
  if (session?.user?.role !== 'admin') throw new Error('No autorizado');
  await db.update(players).set({ level }).where(eq(players.id, playerId));
  revalidatePath('/admin/jugadores');
  revalidatePath('/ranking/M');
  revalidatePath('/ranking/F');
}
```

**Acceptance E7**: cambio de nivel se refleja en ranking inmediatamente.

**Commit E7**: `feat(admin): level editing for players (M8)`

---

## Etapa 8 — Header con paleta court

### T8.1 `src/components/layout/header.tsx`

1. Logo Trophy: `text-court` (era `text-emerald-600`).
2. Active link: `border-b-2 border-court` o pill `bg-court/10 text-court`.
3. Mantener nav items actuales. **NO agregar** "Historial" (queda en M9).
4. Mobile menu: bg `bg-background`, links full-width.

**Commit E8**: `feat(layout): header with court palette (M8)`

---

## Etapa 9 — Tests, lint y build

### T9.1 Tests

Verde:
- `tests/validation/rut.test.ts`
- `tests/validation/phone.test.ts`
- `tests/players/profile-completeness.test.ts`
- Los 26 tests existentes.

### T9.2 Verificación manual (DevTools mobile 375px)

1. **Onboarding**: usuario nuevo Google → `/onboarding`. Paso 1 con RUT inválido bloquea. Paso 1 con phone `912345678` normaliza. Paso 2 selecciona nivel "avanzado", revés "dos manos". Submit → `/ranking/M`.
2. **Ranking**: top-3 con borde dorado/plata/bronce. Click en fila → modal abre. Esc cierra. Refresh con `?player=<id>` → modal sigue abierto.
3. **Player Card**: tab Info muestra edad, mano, revés. Tab Rendimiento muestra stats y dots. WhatsApp abre `wa.me/56...` en nueva pestaña. RUT NO aparece como player.
4. **Fixture**: stepper navega `<` y `>`. Semana cerrada muestra solo resultados. Sin partidos → EmptyState.
5. **Admin /jugadores**: editar nivel → refleja en ranking.
6. **Visual**: todos los números usan `tabular-nums` (alineados). Sin slate hardcoded en pantallas tocadas.

### T9.3 Lint, typecheck, build

```bash
npx biome format --write .
npm run lint
npm run typecheck
npm test
npm run build
```

Sin warnings nuevos.

**Commit final E9**: `chore(m8): format, lint and verification`

```bash
git push -u origin feat/m8-rediseno-mvp
gh pr create --base main --title "M8 — Rediseño: perfil enriquecido, identidad ATP y navegación temporal"
```

---

## Definition of Done (M8)

- [ ] Migraciones aplicadas, sin nulls en columnas obligatorias post-onboarding
- [ ] `npm run lint && typecheck && test && build` verde
- [ ] Login con cuenta nueva fuerza onboarding y bloquea acceso al resto
- [ ] Onboarding rechaza RUT inválido y phone no chileno con mensajes claros
- [ ] Ranking M y F con paleta court, tabular-nums, top-3 destacado
- [ ] Click en fila del ranking abre `PlayerCardModal` (no navega a página dedicada)
- [ ] WhatsApp link funciona en player card cuando phone visible
- [ ] RUT visible solo para admins
- [ ] `/fixture` permite navegar entre semanas pasadas y futuras (no `disponibilidad_*`)
- [ ] Admin puede editar nivel de jugadores
- [ ] Sin `slate-*` hardcoded en componentes tocados
- [ ] PR a `main` creado con descripción y test plan

## Out of scope M8 (queda para M9)

- Vercel Blob / upload de fotos
- Página `/historial` con filtros
- Tab "Evolución" en player modal
- Bottom tab bar mobile
- Indicador snowflake de inactividad
- Dark mode auditado en todas las pantallas
- Toggles de privacidad por campo en perfil
- Search global / cmd+k
- Notificaciones / emails
- Sparkline de evolución
- Snapshots semanales de ranking
