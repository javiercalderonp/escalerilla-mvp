# Project Brief — Escalerilla de Tenis Club La Dehesa

> Documento de introducción al proyecto. Su objetivo es que cualquier persona nueva entienda en 5 minutos **qué es**, **para quién es** y **qué se busca lograr**.
>
> **Índice de documentación**:
>
> | Archivo | Propósito |
> |---|---|
> | `PROJECT_BRIEF.md` | Este archivo. Contexto y alcance general. |
> | `REQUIREMENTS.md` | Épicas, historias de usuario, reglas de negocio `RN-XX`, pendientes resueltos. |
> | `ARCHITECTURE.md` | Stack, estructura, rutas, despliegue, anti-requisitos. |
> | `DATA_MODEL.md` | Schema Drizzle completo, tipos TS, formato CSV seed, `.env.example`. |
> | `BUSINESS_RULES_TESTS.md` | Casos de prueba por regla de negocio, pseudocódigos, contratos de funciones. |
> | `UX_SPEC.md` | Glosario, wireframes ASCII, copy, criterios Gherkin, template WhatsApp. |
> | `TASKS.md` | Backlog por milestones ejecutables. |
> | `DECISIONS.md` | ADRs (Architecture Decision Records). |

---

## 1. Contexto y problema actual

El Club La Dehesa organiza una competencia permanente de tenis entre sus socios llamada **Escalerilla**. Cada semana un administrador (Organizador) coordina partidos entre jugadores de nivel similar, registra resultados y mantiene un ranking que sirve de referencia para los campeonatos internos.

Hoy la operación vive fuera de cualquier sistema:

- **Disponibilidad semanal**: los lunes, el administrador pregunta por WhatsApp quién quiere jugar. Las respuestas son texto libre ("sí", "no", "puedo dos veces", etc.).
- **Armado de cruces**: el administrador arma los partidos manualmente, probablemente con una planilla, intentando respetar restricciones del reglamento (no repetir rival en 30 días, cercanía en ranking, disponibilidad declarada).
- **Publicación del fixture**: se anuncia por WhatsApp quién juega contra quién.
- **Coordinación de día/hora**: los dos jugadores se contactan directamente por WhatsApp para fijar cuándo jugar. Esto **funciona bien socialmente y no debe cambiar**.
- **Registro de resultados**: los jugadores llenan un Google Form antes del domingo en la noche.
- **Cálculo de ranking**: el administrador actualiza manualmente la tabla y la vuelve a publicar.

### Dolores actuales

- Armar el fixture cumpliendo todas las reglas es tedioso y propenso a error humano.
- El ranking con sus reglas (puntuación, penalizaciones por inactividad, desempates, bonus de campeonatos) es difícil de mantener a mano.
- No hay trazabilidad de por qué un jugador subió o bajó en el ranking.
- Un jugador no puede ver fácilmente a quiénes puede desafiar (rango ±5 puestos).
- Los contadores (desafíos del mes, regla 30 días, congelaciones) viven en la cabeza del administrador.

---

## 2. Objetivo del producto

Construir una **web app interna simple** que apoye al Organizador en la operación actual, automatizando lo mecánico pero **sin reemplazar la coordinación social por WhatsApp**.

La app debe:

1. Levantar la disponibilidad semanal de los jugadores de forma estructurada.
2. Proponer cruces semanales respetando las reglas del reglamento; el admin ajusta y publica.
3. Mostrar el fixture de la semana a todos los participantes.
4. Capturar resultados con validación de formato.
5. Calcular el ranking automáticamente aplicando todas las reglas (puntaje, desempates, penalizaciones por inactividad, bonus de campeonatos).
6. Mostrar a cada jugador su "zona desafiable" (±5 puestos) y sus contadores.

La app **no debe** reemplazar:

- La coordinación de día/hora específico entre jugadores (sigue por WhatsApp).
- El canal oficial de desafíos (sigue por WhatsApp; el admin registra el partido resultante).
- La validación humana del administrador (la app **propone**, el admin **confirma**).

---

## 3. Usuarios y roles

| Rol | Quién es | Qué hace en la app |
|---|---|---|
| **Admin / Organizador** | Socio designado por el Comité de Tenis | Gestiona jugadores, abre/cierra semanas, publica fixture, registra resultados, registra desafíos jugados, aplica congelaciones, registra podios de campeonatos. |
| **Jugador** | Socio participante de la Escalerilla | Declara disponibilidad semanal, ve fixture, ve su perfil (partidos, contadores, rango desafiable), ve ranking. |
| **Comité de Tenis / Invitado** | Otros socios interesados | Solo lectura del ranking y el fixture. |

Todas las autenticaciones son vía **Google Sign-In**.

---

## 4. Alcance del MVP

### In scope

- Dos categorías: **singles hombres** y **singles mujeres** con rankings separados.
- Gestión de jugadores (alta, género, congelamientos, retiro).
- Disponibilidad semanal estructurada.
- Propuesta asistida de cruces + ajuste manual + publicación.
- Registro de resultados con validación.
- Ranking automático con todas las reglas del reglamento.
- Visualización de rango desafiable y contadores por jugador.
- Registro manual de desafíos jugados y de resultados de campeonatos internos.
- Generación de un mensaje en texto (fixture, recordatorio) que el admin copia y pega en WhatsApp.

### Out of scope (MVP)

- Coordinación de día/hora entre jugadores dentro de la app.
- Envío automático a WhatsApp (no se integra API de WhatsApp).
- Categoría de dobles.
- Flujo formal de desafío dentro de la app (emitir / aceptar / rechazar).
- Pagos, cuotas de inscripción.
- App móvil nativa (la web será responsive).
- Reserva de canchas.

---

## 5. Criterios de éxito del MVP

- El admin puede armar el fixture semanal en **menos de 10 minutos** (hoy le puede tomar mucho más).
- El ranking se calcula solo tras ingresar resultados, sin intervención manual en casos normales.
- Un jugador puede ver en una pantalla cuántos partidos le quedan esta semana/mes y a quiénes puede desafiar.
- Cero inconsistencias entre "partido registrado" y "puntos aplicados en ranking".
- El admin no necesita mantener una planilla paralela.

---

## 6. Restricciones y supuestos

- **Web app interna**: solo para socios del Club, no pública.
- **Idioma**: 100% español.
- **Volumen**: ~30 a 60 jugadores totales (H+M). Sin problemas de escala.
- **Presupuesto**: bajo. Se priorizan servicios gratuitos o de bajo costo (Vercel + Neon Postgres).
- **Mantenimiento**: liviano. Código simple, pocas dependencias, arquitectura estándar Next.js.
- **Dispositivo principal**: móvil (los jugadores usan el celular como extensión natural de WhatsApp).

---

## 7. Fuente de verdad de las reglas

El **`Reglamento Escalerilla Club La Dehesa 2026.pdf`** (en la raíz del repo) es la fuente oficial. Este documento se cita como fuente en `REQUIREMENTS.md` bajo "Reglas de negocio". Cualquier discrepancia se resuelve a favor del PDF hasta que se apruebe una enmienda.
