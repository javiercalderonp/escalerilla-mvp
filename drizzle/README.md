# Drizzle migrations

`0000_plain_miss_america.sql` fue ajustada manualmente para ser **incremental e idempotente**.

Propósito:
- crear solo `matches` y `match_sets`
- crear enums nuevos de partidos (`match_type`, `match_status`, `match_format`)
- no recrear tablas base ya existentes (`players`, `users`, `ranking_events`, etc.)

Nota:
- Drizzle generó inicialmente un baseline completo porque el repo no tenía historial previo de migraciones.
- Antes de aplicar en la base real, revisar esta SQL y luego correr el apply en el entorno correcto.

Migraciones relevantes posteriores:

- `0001_m8_player_profile_schema.sql`: perfil enriquecido de jugadores y enums de M8.
- `0002_m8_player_profile_backfill.sql`: backfill de nombre/apellido, fecha de ingreso y visibilidad.
- `0003_historical_best_ranking.sql`: mejor ranking histórico.
- `0004_player_general_availability.sql`, `0005_player_wants_next_week.sql`, `0006_player_availability_preferences.sql`: disponibilidad general y preferencias.
- `0007_email_events.sql`: eventos/dedupe de emails.
- `0008_drop_years_playing.sql`: elimina `years_playing` del perfil obligatorio.

Antes de ejecutar `npm run db:push` o SQL manual en production, confirmar que el ambiente apunta a la base correcta y revisar que no haya `DROP` inesperados.
