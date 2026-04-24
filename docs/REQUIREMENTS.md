# Requirements — Escalerilla de Tenis Club La Dehesa

> Capacidades funcionales y reglas de negocio del MVP. Este documento es la fuente para el backlog (`TASKS.md`) y para el modelo de datos (`ARCHITECTURE.md`). Cualquier regla aquí proviene del **Reglamento Provisorio Escalerilla de Tenis Club La Dehesa 2026** (PDF en la raíz del repo). Cuando el reglamento es ambiguo, el supuesto queda marcado explícitamente.

---

## 1. Roles y permisos

| Acción | Admin | Jugador | Invitado |
|---|:---:|:---:|:---:|
| Ver ranking | ✅ | ✅ | ✅ |
| Ver fixture publicado | ✅ | ✅ | ✅ |
| Declarar disponibilidad propia | — | ✅ | — |
| Ver perfil propio (contadores, rango desafiable) | — | ✅ | — |
| Gestionar jugadores (alta/baja/edición) | ✅ | — | — |
| Abrir/cerrar semana | ✅ | — | — |
| Generar propuesta de cruces | ✅ | — | — |
| Publicar fixture | ✅ | — | — |
| Registrar resultados | ✅ | — | — |
| Registrar partidos por desafío | ✅ | — | — |
| Registrar congelación de disponibilidad | ✅ | — | — |
| Registrar resultados de campeonatos internos | ✅ | — | — |
| Ver logs / auditoría | ✅ | — | — |

**Supuesto**: puede haber más de un Admin simultáneo; todos tienen los mismos permisos. La última acción es la que manda (sin workflow de aprobación entre admins).

---

## 2. Épicas e historias de usuario

### Épica A — Gestión de jugadores

- **HU-A1**: Como admin, quiero dar de alta a un jugador ingresando nombre, email, género (M/F) y puntos iniciales de ranking, para que participe de la escalerilla.
- **HU-A2**: Como admin, quiero marcar a un jugador como retirado, para que no aparezca en sorteos futuros pero conserve su historial.
- **HU-A3**: Como admin, quiero registrar una congelación de disponibilidad (semana + motivo: lesión / viaje / otro), para que el jugador quede excluido de sorteos esa semana sin perder puntos.
- **HU-A4**: Como jugador, quiero ver mi perfil con mis partidos jugados, mi posición y mis contadores del mes/semana.

### Épica B — Disponibilidad semanal

- **HU-B1**: Como admin, quiero abrir la ventana de disponibilidad para la próxima semana, para que los jugadores puedan inscribirse.
- **HU-B2**: Como jugador, quiero declarar los días que puedo jugar la próxima semana y cuántos partidos máximo estoy dispuesto a jugar (0, 1, 2 o 3), para que el admin pueda considerarme en el sorteo.
- **HU-B3**: Como admin, quiero ver una vista consolidada de quiénes están disponibles, por categoría, para preparar el fixture.
- **HU-B4**: Como admin, quiero cerrar la ventana de disponibilidad, para que no se modifique una vez que empiezo a armar el fixture.

### Épica C — Fixture semanal

- **HU-C1**: Como admin, quiero que el sistema me proponga cruces respetando restricciones duras (regla 30 días, cupo máximo) y minimizando diferencia de ranking, para ahorrar tiempo.
- **HU-C2**: Como admin, quiero editar la propuesta (mover jugadores entre matches, eliminar un match, agregar uno manual), para resolver casos que el algoritmo no maneje bien.
- **HU-C3**: Como admin, quiero publicar el fixture para que sea visible a todos los jugadores.
- **HU-C4**: Como admin, quiero generar un **mensaje de texto del fixture** que pueda copiar y pegar en WhatsApp, con el formato del club.
- **HU-C5**: Como jugador, quiero ver el fixture de la semana con mis partidos destacados.

### Épica D — Resultados

Flujo decidido (ver ADR-014): **el jugador reporta, el admin confirma**. Los puntos del ranking se aplican solo al confirmar.

- **HU-D1a**: Como jugador de un partido pendiente, quiero reportar el resultado con marcador por set, para que pase a estado "reportado" esperando aprobación del admin.
- **HU-D1b**: Como admin, quiero confirmar un resultado reportado (o editarlo antes de confirmar), para que los puntos se apliquen al ranking.
- **HU-D1c**: Como admin, quiero poder ingresar directamente un resultado confirmado sin pasar por el estado "reportado", para casos en que el admin mismo recibe el resultado por WhatsApp/caseta.
- **HU-D2**: Como admin, quiero marcar un partido como W.O. indicando quién recibe el walk over, para aplicar la penalización.
- **HU-D3**: Como admin, quiero marcar un partido como empate (cuando aplica según las reglas), para aplicar los puntos correctos.
- **HU-D4**: Como admin, quiero editar un resultado ya confirmado, generando eventos compensatorios en el ranking y quedando auditado el cambio.
- **HU-D5**: Como jugador, quiero ver el historial de mis últimos partidos con su resultado.

### Épica E — Ranking

- **HU-E1**: Como usuario, quiero ver el ranking público de cada categoría (H y M) con posición, nombre, puntos, y diferencia con semana anterior.
- **HU-E2**: Como admin, quiero recalcular el ranking a demanda tras ajustes.
- **HU-E3**: Como jugador, quiero ver mi historial de puntos (por qué subí o bajé, evento a evento).

### Épica F — Desafíos (solo visualización)

- **HU-F1**: Como jugador, quiero ver quiénes están 5 puestos arriba y 5 puestos abajo de mí en mi categoría (mi "zona desafiable"), junto con si puedo desafiarlos (regla 30 días con cada uno).
- **HU-F2**: Como jugador, quiero ver cuántos desafíos he aceptado este mes (obligación mínima: 2).
- **HU-F3**: Como admin, quiero registrar un partido como "tipo desafío" (no generado por sorteo) con su resultado, para que entre al ranking y cuente para las restricciones.

### Épica G — Campeonatos internos

- **HU-G1**: Como admin, quiero registrar el podio de un campeonato interno (Campeón, Finalista, Semifinalista, Cuartofinalista), diferenciando entre campeonato regular y Campeonato de Clausura, para aplicar los bonus correspondientes al ranking.
- **HU-G2**: Como admin, quiero registrar los partidos individuales de un campeonato interno entre miembros de la escalerilla, para que sumen puntos además del bonus.

### Épica H — Auditoría y administración

- **HU-H1**: Como admin, quiero ver un log de las acciones recientes (quién registró qué resultado, quién congeló a quién) para resolver disputas.
- **HU-H2**: Como admin, quiero exportar el ranking actual a CSV, para comunicaciones externas.

---

## 3. Reglas de negocio

Cada regla referencia la sección del reglamento de la que se deriva.

### RN-01 — Puntuación por resultado de partido

Fuente: Reglamento §7.

| Situación | Puntos |
|---|---:|
| Ganador | +60 |
| Empate (ambos jugadores) | +35 |
| Perdedor en 3 sets (fue a super tie-break) | +30 |
| Perdedor en 2 sets (no fue a super tie-break) | +20 |
| Perdedor de set largo (modalidad 1h) | +10 |
| W.O. (jugador que no se presenta / no responde) | -20 |

**Supuesto**: el ganador por W.O. recibe +60 y el perdedor por W.O. recibe -20. El reglamento solo especifica el -20 del que no juega; se asume que el que sí se presentó recibe el +60 normal.

### RN-02 — Modalidad de juego y reconocimiento del tipo de partido

Fuente: Reglamento §5.

- **Modalidad MR3**: mejor de 3 sets, 3er set es super tie-break a 10.
- **Modalidad set largo**: si la reserva es de 1 hora, partido a un único set de 9 juegos con tie-break a 7 en caso de empate 8-8.
- **Partidos por tiempo**: si no se termina, gana el jugador con más juegos totales. Si persiste el empate, gana el ganador del primer set. Si no hubo primer set completo, el partido puede quedar en empate.
- **Empates válidos**: 1-1 en sets y juegos idénticos sin tiempo para super tie-break; o 7-7 en set largo.

**Supuesto**: el sistema pregunta explícitamente al registrar resultado si es MR3 o set largo. La puntuación al perdedor depende de esta distinción (RN-01).

### RN-03 — Restricción de repetición de rival

Fuente: Reglamento §4.

Un jugador **no puede jugar partidos de escalerilla sorteados** contra el mismo rival dos veces en un período de 30 días corridos.

**Excepción explícita del reglamento**: los partidos por **desafío** no siguen esta regla de "5 puestos", y además un jugador puede ser desafiado por el mismo jugador dos veces dentro de 30 días solo si es **mutuamente** (el otro también desafió). Un jugador no puede desafiar al mismo jugador dos veces en menos de 30 días.

**Supuesto**: para el sorteo semanal, la restricción dura de 30 días se aplica contra **cualquier** partido previo entre ese par de jugadores (sorteo, desafío o campeonato).

### RN-04 — Límites de partidos por período

Fuente: Reglamento §6.

- Máximo **3 partidos de escalerilla por semana** por jugador.
- Máximo **4 partidos de escalerilla por mes** por jugador.
- Los partidos de **campeonatos internos del Club** no cuentan para estos límites.

### RN-05 — Obligación mínima de disponibilidad

Fuente: Reglamento §4.

- Ningún jugador puede ser obligado a jugar más de **1 partido de escalerilla por semana**.
- Los jugadores tienen la **obligación de aceptar un mínimo de 2 desafíos al mes**.

**Supuesto**: el sistema muestra un contador "desafíos aceptados este mes" en el perfil, pero no bloquea nada — es informativo para el jugador y para el admin.

### RN-06 — Zona desafiable (±5 puestos)

Fuente: Reglamento §4.

- Un jugador puede desafiar a cualquier jugador que esté **hasta 5 puestos más arriba o 5 puestos más abajo** en el ranking **de su categoría**.
- Esta regla **no aplica** a los partidos sorteados (pueden ser contra cualquiera).
- La regla se evalúa al momento del desafío contra el ranking vigente.

### RN-07 — Prioridad del desafiado y W.O. de desafío

Fuente: Reglamento §4.

- Tras un desafío, los jugadores tienen 1 semana para jugarlo (excepciones: si el desafiado ya tiene un partido acordado esa semana o un partido de campeonato, el plazo corre desde ese partido, con máximo de 2 semanas).
- El **desafiado tiene prioridad** para fijar día/hora. Si no hay acuerdo por no disponibilidad del desafiante, el desafío **no tiene validez**.
- Si el desafiado no responde, no acepta o no se juega en plazo → **W.O. al desafiado** (salvo causales legítimas).
- 15 minutos de tolerancia: el que no llegue pierde por W.O.
- Aviso con 24h de anticipación permite reprogramar para el día siguiente si el rival tiene disponibilidad (el rival tiene prioridad; si no puede, sigue siendo W.O.).

**Alcance MVP**: la app **no maneja el flujo de desafío**. El admin simplemente **registra el resultado** del desafío (incluido W.O. si corresponde) en el modo "tipo desafío". La app valida RN-06 y RN-03 al registrar.

### RN-08 — Causales válidas para rechazar un desafío

Fuente: Reglamento §4.

- Ya aceptó 2 desafíos en el mes en curso.
- Ya aceptó un desafío esa misma semana.
- Lesión informada al Organizador o Comité.
- Viaje informado al Organizador o Comité.
- Disponibilidad congelada formalmente.

**Alcance MVP**: informativo. No se valida automáticamente — el admin usa su criterio al registrar.

### RN-09 — Congelación de disponibilidad

Fuente: Reglamento §7.

- Cada jugador dispone de **3 semanas de congelación por semestre** (motivos: lesión, viaje, otro justificado y aceptado por Organizador y Comité).
- Durante la congelación, el jugador:
  - No aparece en el sorteo semanal.
  - No puede ser desafiado.
  - **No pierde puntos por inactividad** (ver RN-10).

### RN-10 — Penalización por inactividad

Fuente: Reglamento §7.

- Un jugador que **no juega un mes completo** pierde **-40 puntos** ese mes (equivalente a dos desafíos no aceptados).
- Un jugador que **no juega 3 meses consecutivos** pierde adicionalmente **-25% de sus puntos**.
- Un jugador que **no juega 6 meses consecutivos** pierde adicionalmente **-50% de sus puntos** (total acumulado de la regla, según lectura del reglamento).
- Un jugador que **no juega 1 año** pierde la **totalidad de sus puntos**.
- **Excepción**: un jugador con lesión justificada y sin semanas de congelación disponibles **NO sufre los escalones del 25/50/100%**, pero **SÍ sufre el -40/mes**.

**Pendiente de definición (PD-01)**: Interpretación del escalonado: ¿el -25% a los 3 meses es único o se recalcula mes a mes? El reglamento dice "perderá adicionalmente el 25%", interpretamos como aplicación **única** en el mes que se cumple el trimestre consecutivo; la próxima aplicación del escalonado es al cumplir los 6 meses consecutivos (-50%).

### RN-11 — Desempates del ranking

Fuente: Reglamento §8.

Orden de criterios cuando dos o más jugadores empatan en puntos:

1. Resultado de los partidos directos entre ellos (Victorias - Derrotas).
2. Mayor diferencia de sets ganados - sets perdidos.
3. Mayor diferencia de juegos ganados - juegos perdidos.
4. Sorteo.

### RN-12 — Bonus de campeonatos internos

Fuente: Reglamento §7.

**Campeonatos internos regulares** (bonus adicional al puntaje por partido):

| Posición | Bonus |
|---|---:|
| Campeón | +150 |
| Finalista | +75 |
| Semifinalista | +50 |
| Cuartofinalista | +25 |

**Campeonato de Clausura** (bonus mayor):

| Posición | Bonus |
|---|---:|
| Campeón | +300 |
| Finalista | +150 |
| Semifinalista | +75 |
| Cuartofinalista | +35 |

Los partidos individuales del campeonato entre miembros de la escalerilla otorgan sus puntos normales de RN-01 **además** del bonus.

### RN-13 — Retiro del jugador

Fuente: Reglamento §7.

- Un jugador retirado **no puede ser desafiado**.
- Sus puntos acumulados **se mantienen** pero siguen sujetos a las reglas de penalización por inactividad (RN-10) mientras no esté formalmente dado de baja.

**Supuesto**: el sistema modela tres estados — `activo`, `congelado` (temporal), `retirado` (permanente dentro de la temporada). Solo `activo` participa de sorteos.

### RN-14 — Pelotas del partido

Fuente: Reglamento §5. **No modelado en MVP**. El desafiador aporta pelotas; es una norma social, no un dato del sistema.

### RN-15 — Actualización del ranking

Fuente: Reglamento §8. El ranking se actualiza **como mínimo semanalmente**. En la app, se recalcula **automáticamente** después de cada resultado registrado y se puede forzar un recálculo completo a demanda del admin.

---

## 4. Requisitos no funcionales

- **Idioma**: 100% español, incluyendo mensajes de error.
- **Dispositivo principal**: móvil (responsive). WhatsApp es el canal paralelo, los jugadores abrirán links desde el teléfono.
- **Rendimiento**: listados de hasta 100 jugadores y 500 partidos por temporada deben renderizar en <1s.
- **Disponibilidad**: 99% es suficiente. Sin SLA formal.
- **Seguridad**: auth Google obligatorio para cualquier acción de escritura. Rutas admin protegidas por rol.
- **Privacidad**: datos personales (nombre, email) no se exponen públicamente; el ranking público usa nombre y apellido del socio.
- **Auditoría**: toda acción del admin queda registrada con fecha, usuario y payload.

---

## 5. Pendientes de definición — **estado post-decisiones 2026-04-24**

Todas las ambigüedades originales fueron discutidas y decididas. Quedan pocas pendientes.

### Resueltas

- **PD-01 ✅** — **Aplicación única por umbral** de RN-10 escalonado. El -25% se aplica una sola vez al cumplir 3 meses sin jugar; el -50% al cumplir 6; el -100% al año. Cualquier partido resetea el contador. El -40/mes sigue corriendo en paralelo. Ver `BUSINESS_RULES_TESTS.md` §6.
- **PD-02 ✅** — **Seed inicial vía CSV** importado por el admin. Formato en `DATA_MODEL.md` §5.
- **PD-03 ✅** — **No se usan días fijos por categoría** en MVP. Solo disponibilidad declarada por el jugador. Si el Comité decide días fijos se evalúa v2.
- **PD-04 ✅** — **Número impar**: el algoritmo deja al jugador no emparejado marcado como "sin pareja" y el admin decide caso a caso (asignar manual o dejar libre).
- **PD-05 ✅** — **Múltiples admins**: last-write-wins sin bloqueo, todo queda en `audit_log`. Suficiente para ~3 admins.
- **PD-06 ✅** — **Cuota de inscripción**: no se trackea en MVP.
- **PD-07 ✅** — **Empate en MR3**: permitido, el admin marca el checkbox "Fue empate" sin causal obligatoria (decisión del usuario).
- **PD-08 ✅** — **Partidos de campeonato**: flujo aparte en `/admin/campeonatos`. Los partidos individuales suman puntos de RN-01 + bonus de podio se aplican al cerrar el campeonato.
- **PD-09 ✅** — **Confirmación de resultados**: el **jugador reporta**, el **admin confirma**. Los puntos se aplican solo al confirmar. Ver HU-D1a/b/c y ADR-014.
- **PD-10 ✅** — **Dobles**: fuera de MVP, confirmado.
- **PD-11 ✅** — **Subcategorías A/B**: fuera de MVP. Solo H y F.

### Nuevas pendientes (menores)

- **PD-12** — Dominio final del club: se usa `.vercel.app` por ahora. Si el Club quiere dominio custom, se decide después.
- **PD-13** — Texto del mensaje de recordatorio de disponibilidad: el template propuesto en `UX_SPEC.md` §7.3 es una propuesta; confirmar con el Organizador antes de production.
- **PD-14** — Número esperado de jugadores: ~50 H + ~30 M iniciales con crecimiento esperado. El sistema debe soportar 200+ sin cambios.

---

## 6. Interpretación operativa de conceptos de tiempo

Para evitar ambigüedad en la implementación, fijar las siguientes definiciones:

| Concepto | Definición | Fuente |
|---|---|---|
| **Zona horaria** | `America/Santiago` para todos los cálculos de calendario. | ADR-013 |
| **Semana** | Semana ISO-8601: lunes 00:00 → domingo 23:59:59.999 `America/Santiago`. | D-20 |
| **Mes** | Mes calendario: día 1 a último día, `America/Santiago`. | — |
| **Semestre** | H1 = enero-junio, H2 = julio-diciembre del año calendario. | D-14 (decisión) |
| **30 días (regla rival)** | 30 días corridos desde la fecha del partido anterior. Cumplir 30 días **exactos permite** un nuevo partido (regla "menos de 30 días" del reglamento). | PD-14 |
| **Semana operativa** | Abre el lunes; el admin cierra manualmente (no hay auto-cierre). | D-20 |
| **Hora del cron de inactividad** | Lunes 03:00 `America/Santiago` (06:00 UTC). | D-14 |
