# UX Spec — Escalerilla de Tenis Club La Dehesa

> **Propósito**: glosario de dominio, wireframes ASCII de cada pantalla, copy en español, criterios de aceptación Gherkin y el template del mensaje para WhatsApp. Cada agente que implemente UI debe consultarlo para no inventar terminología ni layouts.
>
> **Dispositivo de referencia**: móvil (375px). Desktop es secundario.

---

## 1. Glosario

| Término | Definición | Cómo se dice en inglés (si aplica) |
|---|---|---|
| **Escalerilla** | Competencia permanente del Club La Dehesa. No es un torneo eliminatorio, es un sistema de ranking continuo. | "Ladder tournament" |
| **Organizador / Admin** | Socio designado para coordinar partidos y actualizar ranking. | Admin |
| **Jugador** | Socio activo en la escalerilla con ranking propio. | Player |
| **Categoría** | En el MVP solo `M` (hombres) y `F` (mujeres). | Category |
| **Disponibilidad** | Declaración semanal del jugador indicando qué días puede jugar y cuántos partidos máximo. | Availability |
| **Fixture** | Listado de partidos asignados para una semana. | Schedule / Fixture |
| **Cruces** | Pareos entre jugadores para una semana. | Pairings / Matchups |
| **Sorteo** | Algoritmo que propone cruces respetando restricciones. Tipo de partido cuando se genera así. | Draw |
| **Desafío** | Partido donde un jugador reta a otro dentro del rango ±5 puestos. | Challenge |
| **Zona desafiable** | Jugadores ±5 puestos del actual en el ranking. | Challenge zone |
| **W.O. (Walk Over)** | Partido perdido por no presentarse o no responder. Penaliza -20 pts. | Walk over |
| **MR3** | Mejor de 3 sets. Tercer set es super tie-break a 10. | Best of 3 |
| **Set largo** | Modalidad de 1 hora: un solo set a 9 juegos con tie-break a 7 al 8-8. | Pro set / long set |
| **Super tie-break** | Tie-break a 10 puntos con diferencia ≥2. Reemplaza al 3er set en MR3. | Match tie-break |
| **Tie-break** | Juego desempatador dentro de un set (a 7 pts en set corto 7-6, a 7 pts en set largo 9-8). | Tie-break |
| **Congelación** | Estado temporal (por lesión/viaje/otro) donde el jugador no participa en sorteos ni puede ser desafiado. Máx 3 semanas por semestre. | Freeze |
| **Ranking inicial** | Puntos con los que arranca la temporada. Seed desde CSV. | Initial seed |
| **Campeonato interno** | Torneo eliminatorio del Club (no parte de la escalerilla pero otorga bonus al ranking). | Internal championship |
| **Campeonato de Clausura** | Torneo más importante del año. Bonus doble de un campeonato regular. | Clausura championship |
| **Semana ISO** | Numeración semanal ISO-8601 (lunes-domingo). | ISO week |

---

## 2. Paleta y tipografía (lineamientos)

- **Tipografía**: `system-ui, -apple-system, sans-serif` en el CSS base de Tailwind.
- **Acento primario**: verde cancha (`emerald-600` de Tailwind).
- **Acento secundario**: amarillo pelota (`yellow-400`).
- **Neutro**: `slate-*`.
- **Estados**:
  - Éxito: `emerald-600`.
  - Advertencia: `amber-500`.
  - Error: `rose-600`.
  - Info: `sky-600`.
- **Radii**: `rounded-lg` (8px) por defecto, `rounded-full` para avatares y badges.
- **Dark mode**: **NO en MVP**.

---

## 3. Estructura de navegación

```
Header (fijo):
  [🎾 Escalerilla]   Ranking   Fixture   Mi perfil   [Avatar ▾]

Avatar menu:
  - Mi perfil
  - Declarar disponibilidad (si es jugador)
  - Panel admin (si es admin)
  - Cerrar sesión
```

En móvil, la nav colapsa a hamburguesa con los mismos ítems.

---

## 4. Wireframes por pantalla

### 4.1 `/` — Landing + Ranking público

```
┌────────────────────────────────────────────┐
│ 🎾 Escalerilla  Ranking Fixture Perfil  ≡  │
├────────────────────────────────────────────┤
│                                            │
│   Ranking Escalerilla 2026                 │
│   ───────────────────────                  │
│   [ Hombres ] [ Mujeres ]      ← tabs      │
│                                            │
│   #  Jugador           Puntos   Δ semana   │
│   1  Juan Pérez          420     ▲ 60      │
│   2  Pedro García        380     —         │
│   3  Diego Rojas         350     ▼ 20      │
│   4  Mateo López         300     ▲ 30      │
│   5  Sergio Muñoz        250     —         │
│   ...                                      │
│                                            │
│   Actualizado: hoy 14:22                   │
│                                            │
└────────────────────────────────────────────┘
```

- Click en fila → navega a `/ranking/[categoria]/[playerId]` (historial del jugador).
- Empty state si no hay jugadores: "Aún no hay jugadores cargados. Habla con el organizador."

### 4.2 `/fixture` — Fixture de la semana

```
┌────────────────────────────────────────────┐
│ Fixture · Semana 17 (20 – 26 abr)          │
│ Estado: PUBLICADO                          │
│                                            │
│ SINGLES HOMBRES                            │
│ ┌──────────────────────────────────────┐   │
│ │ Juan Pérez  vs  Pedro García         │   │
│ │ #1                 #2                │   │
│ └──────────────────────────────────────┘   │
│ ┌──────────────────────────────────────┐   │
│ │ Diego Rojas vs  Mateo López  ★ TÚ    │   │
│ │ #3                 #4                │   │
│ └──────────────────────────────────────┘   │
│                                            │
│ SINGLES MUJERES                            │
│ ┌──────────────────────────────────────┐   │
│ │ Ana Silva   vs  María Torres         │   │
│ └──────────────────────────────────────┘   │
│                                            │
│ Coordinen día y hora por WhatsApp.         │
└────────────────────────────────────────────┘
```

- Partidos del usuario logueado marcados con `★ TÚ`.
- Si no hay fixture publicado: mostrar "Aún no hay fixture publicado para esta semana."

### 4.3 `/disponibilidad` — Declarar disponibilidad

```
┌────────────────────────────────────────────┐
│ Declarar disponibilidad                    │
│ Semana 18 (27 abr – 3 may)                 │
│                                            │
│ ¿Qué días puedes jugar?                    │
│ □ Lun  ☑ Mar  □ Mié  ☑ Jue  □ Vie  □ Sáb  □ Dom
│                                            │
│ ¿Máximo de partidos esta semana?           │
│ ( ) 0  ( ) 1  (●) 2  ( ) 3                 │
│                                            │
│ [Guardar]                                  │
│                                            │
│ Ya declaraste el lunes a las 10:32.        │
│ Puedes actualizar hasta que el organizador │
│ cierre la inscripción.                     │
└────────────────────────────────────────────┘
```

- Toast de éxito: "Disponibilidad guardada. Gracias!"
- Si la semana ya está cerrada: form en solo-lectura con mensaje "Inscripción cerrada."

### 4.4 `/mi-perfil` — Perfil del jugador

```
┌────────────────────────────────────────────┐
│ Juan Pérez · Categoría Hombres · #1        │
│ 420 puntos                                 │
│                                            │
│ ESTA SEMANA                                │
│ Partidos jugados: 1 / 3                    │
│ Partidos este mes: 2 / 4                   │
│ Desafíos aceptados este mes: 1 / 2 mín.    │
│                                            │
│ MI ZONA DESAFIABLE                         │
│ (No aplica — estás #1)                     │
│ Puedo desafiar:                            │
│ - #2 Pedro García     ✓ disponible         │
│ - #3 Diego Rojas      ✗ jugamos hace 12d   │
│ - #4 Mateo López      ✓ disponible         │
│ - #5 Sergio Muñoz     ✓ disponible         │
│ - #6 Tomás Vergara    ✓ disponible         │
│                                            │
│ MIS PARTIDOS                               │
│ 22/04 vs Pedro García  ✓ Ganado 6-4 3-6 10-7
│ 15/04 vs Mateo López   ✓ Ganado 6-3 6-2    │
│ 08/04 vs Diego Rojas   ✗ Perdido 2-6 4-6   │
│ [Ver todo el historial]                    │
│                                            │
└────────────────────────────────────────────┘
```

- Contadores visibles con semáforo: verde < 70%, amarillo 70-99%, rojo 100%.
- Link "Ver todo" → lista paginada.

### 4.5 `/admin` — Dashboard admin

```
┌────────────────────────────────────────────┐
│ Panel del Organizador                      │
│                                            │
│ SEMANA ACTUAL (18) · 27 abr – 3 may        │
│ Estado: disponibilidad abierta             │
│ 14 de 50 jugadores H declararon            │
│  6 de 30 jugadoras M declararon            │
│ [Ver semana]                               │
│                                            │
│ ACCIONES RÁPIDAS                           │
│ ▸ Registrar resultado                      │
│ ▸ Registrar desafío jugado                 │
│ ▸ Crear congelación                        │
│ ▸ Abrir próxima semana                     │
│                                            │
│ PENDIENTES                                 │
│ • 2 partidos reportados esperando tu       │
│   confirmación                             │
│ • 3 partidos del fixture sin resultado     │
│                                            │
└────────────────────────────────────────────┘
```

### 4.6 `/admin/semanas/[id]/fixture` — Armado de cruces

```
┌────────────────────────────────────────────┐
│ Fixture · Semana 18                        │
│ Estado: disponibilidad cerrada             │
│                                            │
│ SINGLES HOMBRES                            │
│ Disponibles: 14                            │
│ [Generar propuesta]                        │
│                                            │
│ Propuesta:                                 │
│ ┌──────────────────────────────────────┐   │
│ │ Juan (420) vs Pedro (380) · Δ 40     │   │
│ │                               [✕]    │   │
│ └──────────────────────────────────────┘   │
│ ┌──────────────────────────────────────┐   │
│ │ Diego (350) vs Mateo (300) · Δ 50    │   │
│ │                               [✕]    │   │
│ └──────────────────────────────────────┘   │
│                                            │
│ Sin pareja:                                │
│ ⚠ Sergio Muñoz (250) – sin candidatos      │
│   [Asignar manual ▾]                       │
│                                            │
│ SINGLES MUJERES                            │
│ [Generar propuesta]                        │
│ ...                                        │
│                                            │
│ [Publicar fixture]  [Ver preview WhatsApp] │
│                                            │
└────────────────────────────────────────────┘
```

- Dropdown "Asignar manual" lista jugadores disponibles restantes.
- Botón "Publicar" pasa estado a `fixture_publicado` y revela botón "Copiar mensaje WhatsApp".

### 4.7 `/admin/partidos/[id]` — Registrar resultado

```
┌────────────────────────────────────────────┐
│ Partido: Juan Pérez vs Pedro García        │
│ Semana 17 · Singles Hombres · Sorteo       │
│                                            │
│ Fecha jugada: [22/04/2026]                 │
│                                            │
│ Modalidad:                                 │
│ (●) Mejor de 3 sets (MR3)                  │
│ ( ) Set largo (9 juegos)                   │
│                                            │
│ Set 1:                                     │
│ Juan [6]  –  Pedro [4]                     │
│                                            │
│ Set 2:                                     │
│ Juan [3]  –  Pedro [6]                     │
│                                            │
│ Set 3 (super tie-break):                   │
│ Juan [10] –  Pedro [7]                     │
│                                            │
│ ¿Fue empate? ☐                             │
│ ¿Fue W.O.? ☐                               │
│                                            │
│ Ganador: Juan Pérez (auto)                 │
│                                            │
│ [Confirmar resultado]                      │
└────────────────────────────────────────────┘
```

- Sets se agregan dinámicamente según modalidad.
- Validación en vivo: si el score no es válido → mensaje "Score 6-5 no es válido en set corto. Debe ser 6-X, 7-5 o 7-6."
- Ganador se infiere; si empate se habilita.

### 4.8 `/admin/jugadores` — CRUD de jugadores

```
┌────────────────────────────────────────────┐
│ Jugadores                                  │
│ [+ Nuevo jugador]  [Importar CSV]          │
│                                            │
│ Filtro: [Todos ▾] [H/M ▾] [Estado ▾]       │
│                                            │
│ Nombre              Email    Género Estado │
│ Juan Pérez          juan@… M       activo  │
│ Pedro García        —       M       activo  │
│ Diego Rojas         …       M       congelado│
│ María Torres        …       F       activo  │
│ ...                                        │
└────────────────────────────────────────────┘
```

### 4.9 `/login` — Login

```
┌────────────────────────────────────────────┐
│                                            │
│        🎾 Escalerilla La Dehesa            │
│                                            │
│        Inicia sesión para continuar        │
│                                            │
│        [ G  Continuar con Google ]         │
│                                            │
│                                            │
│  ¿Problemas? Habla con el organizador.     │
│                                            │
└────────────────────────────────────────────┘
```

---

## 5. Copy (mensajes y textos en español)

### 5.1 Botones frecuentes

| Contexto | Texto |
|---|---|
| Acción primaria | "Guardar" / "Confirmar" / "Publicar" |
| Cancelar | "Cancelar" (no "Volver") |
| Borrar | "Eliminar" (con confirmación) |
| Agregar | "Agregar" / "Nuevo" |
| Importar | "Importar CSV" |
| Exportar | "Exportar" |
| Copiar | "Copiar mensaje" (con check icon tras click) |

### 5.2 Toasts

| Situación | Texto |
|---|---|
| Guardado OK | "Guardado correctamente." |
| Error genérico | "Algo falló. Intenta de nuevo." |
| Sin conexión | "Parece que no hay conexión." |
| Score inválido | "Score inválido: {detalle}." |
| Mensaje copiado | "Mensaje copiado al portapapeles." |
| Fixture publicado | "Fixture publicado. Ya puedes copiarlo para WhatsApp." |

### 5.3 Empty states

| Pantalla | Mensaje |
|---|---|
| Ranking vacío | "Aún no hay jugadores cargados. Habla con el organizador." |
| Fixture no publicado | "Aún no hay fixture publicado para esta semana." |
| Sin partidos en historial | "Todavía no registras partidos esta temporada." |
| Sin disponibilidad declarada | "Aún no has declarado disponibilidad esta semana." |

### 5.4 Errores de validación (formularios)

| Campo | Mensaje |
|---|---|
| Email inválido | "Ingresa un email válido." |
| Nombre vacío | "El nombre es obligatorio." |
| Puntos negativos | "Los puntos iniciales no pueden ser negativos." |
| CSV malformado | "No pude leer el CSV: {detalle}. Revisa el formato." |
| Score incompleto | "Falta completar el set {n}." |
| Score inválido | "El score {X}–{Y} no es válido en esta modalidad." |
| Días vacíos | "Debes seleccionar al menos un día." |
| Max matches fuera de rango | "El máximo debe estar entre 0 y 3." |
| Jugadores iguales | "No puedes emparejar a un jugador consigo mismo." |
| Ya existe partido | "Este partido ya existe en el fixture." |
| Regla 30 días | "{A} y {B} jugaron hace {n} días. Hay que esperar {n} más." |
| Freeze sin cupo | "{Jugador} ya usó sus 3 congelaciones este semestre." |
| Cupo semanal lleno | "{Jugador} ya tiene 3 partidos esta semana." |

---

## 6. Criterios de aceptación (Gherkin) de historias críticas

### HU-B2 — Declarar disponibilidad

```gherkin
Escenario: Jugador declara disponibilidad por primera vez
  Dado que soy un jugador activo
  Y la semana está en estado "disponibilidad_abierta"
  Cuando abro /disponibilidad
  Y marco días ["Martes", "Jueves"]
  Y selecciono max_matches = 2
  Y hago click en "Guardar"
  Entonces veo un toast "Guardado correctamente"
  Y la próxima vez que abra la pantalla, veo mis datos pre-cargados

Escenario: Jugador intenta declarar tras cierre
  Dado que la semana está en "disponibilidad_cerrada"
  Cuando abro /disponibilidad
  Entonces el formulario está en solo-lectura
  Y veo un mensaje "Inscripción cerrada"
```

### HU-C1 — Generar propuesta de fixture

```gherkin
Escenario: Admin genera propuesta para semana con 10 disponibles pares
  Dado que soy admin
  Y 10 jugadores H declararon disponibilidad con max_matches >= 1
  Y ninguno jugó entre sí en los últimos 30 días
  Cuando abro /admin/semanas/18/fixture
  Y hago click "Generar propuesta" en categoría H
  Entonces veo 5 partidos propuestos
  Y cada uno minimiza la diferencia de puntos con el siguiente disponible
  Y la lista "Sin pareja" está vacía

Escenario: Admin genera propuesta con impar
  Dado que hay 7 jugadores H disponibles
  Cuando genero propuesta
  Entonces veo 3 partidos propuestos
  Y 1 jugador en "Sin pareja" con razón "sin pareja elegible"

Escenario: Dos jugadores ya jugaron hace menos de 30 días
  Dado que A (400pts) y B (380pts) jugaron hace 10 días
  Y están disponibles para esta semana
  Y hay un C (300pts) y D (250pts) disponibles
  Cuando genero propuesta
  Entonces A se empareja con C (el más cercano elegible)
  Y B se empareja con D
```

### HU-D1 — Registrar resultado

```gherkin
Escenario: Admin confirma resultado 2-1 en MR3
  Dado un partido pendiente entre Juan y Pedro
  Cuando abro /admin/partidos/{id}
  Y selecciono modalidad "MR3"
  Y ingreso sets: 6-4, 3-6, 10-7
  Y hago click "Confirmar resultado"
  Entonces el partido queda en estado "confirmado"
  Y Juan recibe +60 puntos (ranking_event match_win)
  Y Pedro recibe +30 puntos (ranking_event match_loss_3s)
  Y el ranking se actualiza

Escenario: Admin intenta confirmar score inválido
  Dado un partido pendiente
  Cuando ingreso set 1: 8-6
  Entonces veo el error "El score 8-6 no es válido en set corto"
  Y el botón "Confirmar" está deshabilitado

Escenario: Admin registra W.O.
  Dado un partido pendiente entre Juan y Pedro
  Cuando marco "Fue W.O." y elijo Pedro como perdedor
  Y confirmo
  Entonces el estado es "wo"
  Y Juan recibe +60 (wo_win)
  Y Pedro recibe -20 (wo_loss)
```

### HU-E1 — Ver ranking

```gherkin
Escenario: Usuario público ve ranking
  Cuando abro /
  Entonces veo dos tabs: "Hombres" y "Mujeres"
  Y en "Hombres" veo la lista ordenada por puntos descendente
  Y jugadores "retirados" no aparecen
  Y cada fila muestra posición, nombre, puntos y Δ semana

Escenario: Empate en puntos resuelto por H2H
  Dado que A y B tienen 400 puntos
  Y A ganó 2 de 3 partidos entre ellos
  Cuando veo el ranking
  Entonces A aparece antes que B
```

### HU-F1 — Zona desafiable

```gherkin
Escenario: Jugador #5 ve su zona
  Dado que soy el jugador #5 de categoría H
  Cuando abro /mi-perfil
  Entonces veo los jugadores rank 1 a 4 como "puedo desafiar hacia arriba"
  Y los jugadores rank 6 a 10 como "puedo desafiar hacia abajo"
  Y cualquiera que haya jugado conmigo hace <30 días aparece marcado como "jugamos hace Xd"
```

### HU-D1b — Confirmación con flujo jugador→admin

```gherkin
Escenario: Jugador reporta resultado
  Dado que soy un jugador de un partido pendiente
  Cuando ingreso el resultado desde mi perfil
  Entonces el partido queda en estado "reportado"
  Y el admin ve el partido en "pendientes de confirmar"
  Y los puntos NO se aplican aún

Escenario: Admin aprueba resultado reportado
  Dado un partido en estado "reportado"
  Cuando el admin lo aprueba
  Entonces pasa a "confirmado"
  Y se aplican los ranking_events correspondientes
```

---

## 7. Template del mensaje de fixture para WhatsApp

> **Contexto**: hoy el admin manda una foto con los partidos. La app genera un texto que el admin copia y pega. Si el admin prefiere seguir usando foto, la app igual lo tiene disponible.

### 7.1 Template exacto (literal, con placeholders)

```
🎾 FIXTURE ESCALERILLA · Semana {isoWeek} ({startDMM} al {endDMM})

SINGLES HOMBRES
• {p1Name} vs {p2Name}
• {p1Name} vs {p2Name}

SINGLES MUJERES
• {p1Name} vs {p2Name}

Coordinen día y hora por acá. Recuerden reportar el resultado en la app antes del domingo.
```

### 7.2 Reglas del template

1. Encabezado fijo en mayúsculas: `🎾 FIXTURE ESCALERILLA · Semana {N} ({start} al {end})`.
2. Fechas: formato español `D MMM` → `20 abr`, `3 may`.
3. Sección por categoría con título en mayúsculas. Si no hay partidos en una categoría, se **omite la sección completa** (no se pone "SINGLES MUJERES" vacío).
4. Separador entre sección y bullets: una línea en blanco.
5. Cada partido en su propia línea, con bullet `• ` (u+2022).
6. Formato de partido: `{nombre_completo_p1} vs {nombre_completo_p2}` — `vs` en minúscula, sin `.`, espacios simples.
7. Orden dentro de la categoría: alfabético por `fullName` del player1.
8. Línea final fija: `Coordinen día y hora por acá. Recuerden reportar el resultado en la app antes del domingo.`
9. Si no hay partidos en ninguna categoría → la función devuelve `null` y la UI oculta el botón.

### 7.3 Template del mensaje de recordatorio de disponibilidad (opcional)

```
🎾 ESCALERILLA · Semana {nextIsoWeek}

Hola! Recuerden declarar su disponibilidad para la próxima semana antes del {deadlineDMM} a las {deadlineHora}.

Link: {fullUrl}/disponibilidad

Cualquier duda me avisan.
```

---

## 8. Responsive breakpoints

Tailwind defaults:

| Nombre | Ancho mínimo | Uso |
|---|---|---|
| `sm` | 640px | tablets chicas |
| `md` | 768px | tablets |
| `lg` | 1024px | desktop |
| `xl` | 1280px | desktop grande |

**Priorizar mobile**: todas las pantallas deben ser usables en 375px sin scroll horizontal.

**Desktop**: layouts de 2 columnas en `/admin/*` cuando cabe, 1 columna en móvil.

---

## 9. Accesibilidad mínima

- Todos los botones de ícono tienen `aria-label`.
- Contraste AA en todos los textos (especial cuidado con `slate-400` sobre `white`).
- Inputs siempre tienen `<label>` visible (no solo placeholder).
- El foco es visible (outline `emerald-600`).
- Navegación por teclado funciona en toda la app.

**No requerimos** auditoría WCAG ni screen reader testing en MVP.

---

## 10. Iconos (lucide-react)

| Contexto | Icono |
|---|---|
| Ganado | `Trophy` |
| Perdido | `X` |
| Empate | `Equal` |
| W.O. | `UserX` |
| Congelado | `Snowflake` |
| Desafío | `Swords` |
| Ranking arriba | `ArrowUp` |
| Ranking abajo | `ArrowDown` |
| Copiar | `Copy` |
| Importar | `Upload` |
| Exportar | `Download` |
| Editar | `Pencil` |
| Eliminar | `Trash2` |
| Check | `Check` |
| WhatsApp | `MessageCircle` (lucide no tiene WhatsApp específico) |

---

## 11. Estados de carga (skeletons)

- Listas: `<Skeleton />` de shadcn por fila, 3-5 filas.
- Tablas: 5 filas skeleton.
- Cards: un skeleton de card completo.
- No usar spinners centrales salvo acciones bloqueantes (publicar fixture).

---

## 12. Anti-patrones UX a evitar

- ❌ No usar modales anidados.
- ❌ No usar accordions para información crítica.
- ❌ No ocultar el estado de un partido detrás de hover.
- ❌ No usar tooltips como única fuente de información.
- ❌ No agregar animaciones decorativas (fade, slide) salvo transiciones suaves de estado.
- ❌ No usar colores como única señal (siempre acompañar con icono o texto).
