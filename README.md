# Escalerilla MVP

Aplicacion Next.js para administrar la escalerilla de tenis del Club La Dehesa: ranking publico, disponibilidad semanal, generacion de fixture, resultados, desafios, congelaciones, campeonatos internos, onboarding de jugadores y correos operativos.

## Stack

- Next.js 16 App Router, React 19 y TypeScript.
- Tailwind CSS 4 y componentes propios basados en shadcn/ui.
- Auth.js / NextAuth con Google y credenciales.
- Postgres en Neon via Drizzle ORM.
- Vitest para reglas de negocio y validaciones.
- Vercel para hosting y cron jobs.

## Desarrollo local

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`.

Comandos utiles:

```bash
npm run lint
npm run test
npm run build
npm run db:generate
npm run db:push
npm run db:seed
```

## Variables de entorno

Crear `.env` local con:

```bash
DATABASE_URL=
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
ADMIN_EMAILS=
NEXT_PUBLIC_APP_URL=http://localhost:3000
EMAILS_ENABLED=false
EMAIL_FROM=
EMAIL_TEST_RECIPIENT=
RESEND_API_KEY=
MATCH_RESULT_EMAILS_ENABLED=false
MATCH_RESULT_EMAIL_FROM=
```

Notas:

- `ADMIN_EMAILS` acepta correos separados por coma.
- Si `AUTH_GOOGLE_ID` y `AUTH_GOOGLE_SECRET` estan vacios, el login con Google no se registra y queda disponible el provider de credenciales.
- No commitear secretos ni archivos `client_secret*.json`.

## Rutas principales

- `/`: home con ranking, partidos recientes y explicacion para jugadores.
- `/ranking` y `/ranking/[categoria]`: ranking publico H/M y perfil de jugador.
- `/fixture`: programacion semanal, navegacion historica e impresion.
- `/disponibilidad`: declaracion semanal del jugador.
- `/mi-perfil`: perfil, contadores, zona desafiable y partidos.
- `/ingresar-resultado`: ingreso de resultado por jugador/admin.
- `/onboarding`: perfil obligatorio de jugador.
- `/admin/jugadores`: jugadores y perfil deportivo.
- `/admin/semanas`: semanas, disponibilidad consolidada y fixture.
- `/admin/desafios`: registro de desafios.
- `/admin/congelaciones`: congelaciones justificadas.
- `/admin/campeonatos`: podios y bonus de campeonatos.
- `/admin/emails/preview`: preview de templates de correo.
- `/reglamento`: reglamento publico.

## Documentacion

- [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md): contexto y objetivo del producto.
- [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md): historias y reglas del reglamento.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): arquitectura tecnica.
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md): schema y convenciones de datos.
- [docs/TASKS.md](docs/TASKS.md): estado del backlog.
- [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md): guia operativa del administrador.
- [docs/USER_FEATURES_PRESENTATION.md](docs/USER_FEATURES_PRESENTATION.md): presentacion de funcionalidades de cara al usuario.
- [docs/M8_REDESIGN.md](docs/M8_REDESIGN.md): detalle historico del rediseño/perfil enriquecido.

## Cron jobs

`vercel.json` configura:

- `/api/cron/recordatorio-disponibilidad`, lunes 14:00 UTC.

Tambien existe `/api/cron/inactividad` para penalizaciones de inactividad; mantener su programacion alineada con la decision operativa vigente antes de activarlo en Vercel.
