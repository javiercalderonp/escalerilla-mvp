# Drizzle migrations

`0000_plain_miss_america.sql` fue ajustada manualmente para ser **incremental e idempotente**.

Propósito:
- crear solo `matches` y `match_sets`
- crear enums nuevos de partidos (`match_type`, `match_status`, `match_format`)
- no recrear tablas base ya existentes (`players`, `users`, `ranking_events`, etc.)

Nota:
- Drizzle generó inicialmente un baseline completo porque el repo no tenía historial previo de migraciones.
- Antes de aplicar en la base real, revisar esta SQL y luego correr el apply en el entorno correcto.
