# Guia Admin — Escalerilla Club La Dehesa

> Guia operativa para administrar una semana normal de escalerilla. La documentacion tecnica vive en `ARCHITECTURE.md`, `DATA_MODEL.md` y `REQUIREMENTS.md`.

## 1. Acceso

1. Entrar a `/login`.
2. Iniciar sesion con Google o credenciales.
3. Verificar que el correo este incluido en `ADMIN_EMAILS`; si no, la cuenta queda como jugador/invitado.

## 2. Ciclo semanal recomendado

### Lunes: abrir o preparar semana

1. Ir a `/admin/semanas`.
2. Crear la semana si no existe.
3. Abrir disponibilidad para que los jugadores declaren en `/disponibilidad`.
4. Usar el mensaje de recordatorio o el cron `/api/cron/recordatorio-disponibilidad` si esta activo en Vercel.

### Antes del sorteo: revisar disponibilidad

1. Entrar al detalle de la semana desde `/admin/semanas`.
2. Revisar disponibilidad por categoria.
3. Ajustar jugadores manualmente cuando haga falta.
4. Revisar congelaciones vigentes en `/admin/congelaciones`.

### Publicar fixture

1. Entrar a `/admin/semanas/[id]/fixture`.
2. Generar propuesta por categoria.
3. Revisar alertas de repeticion de rival, cupos y disponibilidad.
4. Ajustar cruces manualmente.
5. Publicar fixture.
6. Compartir `/fixture` o imprimir desde `/fixture/imprimir`.

### Durante la semana: resultados

1. Los jugadores pueden ingresar resultados desde `/ingresar-resultado`.
2. El admin puede registrar o corregir resultados cuando llegan por WhatsApp.
3. Para W.O., indicar el jugador que pierde por no presentarse.
4. Para empates, registrar el estado correspondiente para aplicar +35 a ambos.

Los puntos se registran como eventos en `ranking_events`; las correcciones agregan eventos compensatorios en vez de borrar historial.

## 3. Jugadores

Usar `/admin/jugadores` para:

- Crear jugadores.
- Editar email, genero, estado y perfil deportivo.
- Revisar datos de contacto y disponibilidad general.
- Marcar jugadores como retirados sin perder historial.

El onboarding del jugador completa datos obligatorios: nombre, apellido, fecha de nacimiento, telefono, RUT, nivel, mano dominante, reves y disponibilidad general.

## 4. Desafios

Usar `/admin/desafios` cuando un partido no nace del sorteo semanal.

El sistema valida:

- Zona desafiable de +/- 5 puestos.
- Repeticion de rival segun RN-03.
- Justificacion de override cuando el admin decide registrar igual.

## 5. Congelaciones

Usar `/admin/congelaciones` para lesiones, viajes u otros motivos aceptados.

Regla operativa:

- Maximo 3 semanas por semestre.
- El jugador congelado no aparece en el sorteo.
- La congelacion se considera para exenciones de inactividad segun RN-10.

## 6. Campeonatos

Usar `/admin/campeonatos` para registrar podios y bonus.

Bonus actuales:

- Campeon: +150.
- Finalista: +75.
- Tercer lugar / semifinalista segun flujo configurado: revisar formulario antes de confirmar.

Los partidos individuales de campeonato se registran como `type='campeonato'` y no cuentan para limites semanales/mensuales de escalerilla.

## 7. Emails

Templates disponibles en `src/lib/email` y preview en `/admin/emails/preview`.

Variables relevantes:

- `EMAILS_ENABLED`
- `EMAIL_FROM`
- `EMAIL_TEST_RECIPIENT`
- `RESEND_API_KEY`
- `MATCH_RESULT_EMAILS_ENABLED`
- `MATCH_RESULT_EMAIL_FROM`

Antes de activar production, validar remitente, dominio y destinatarios de prueba.

## 8. Cron jobs

`vercel.json` programa actualmente:

- `/api/cron/recordatorio-disponibilidad`, lunes 14:00 `America/Santiago` (17:00 o 18:00 UTC según horario de verano).
- `/api/cron/eliminar-partidos-pendientes`, diariamente 06:00 UTC. Elimina partidos pendientes sin resultado creados hace 21 dias o mas.

Existe `/api/cron/inactividad`, pero su ejecucion programada debe activarse solo cuando el Comité confirme la politica exacta de penalizaciones automaticas.

## 9. Checklist antes de production

- `npm run lint`
- `npm run test`
- `npm run build`
- Migraciones aplicadas en la base correcta.
- `ADMIN_EMAILS` configurado.
- OAuth Google con URL de production.
- Emails probados con destinatario controlado.
- Fixture, ranking, disponibilidad y resultado probados desde mobile.
