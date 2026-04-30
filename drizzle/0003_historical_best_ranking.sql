ALTER TABLE "players"
  ADD COLUMN IF NOT EXISTS "best_ranking_position" integer,
  ADD COLUMN IF NOT EXISTS "best_ranking_achieved_at" timestamp with time zone;

WITH ranked AS (
  SELECT
    p.id,
    row_number() OVER (
      PARTITION BY p.gender
      ORDER BY coalesce(sum(re.delta), 0) DESC, p.full_name ASC
    ) AS position
  FROM players p
  LEFT JOIN ranking_events re ON re.player_id = p.id
  WHERE p.status IN ('activo', 'congelado')
  GROUP BY p.id, p.gender, p.full_name
)
UPDATE players p
SET
  best_ranking_position = ranked.position,
  best_ranking_achieved_at = now()
FROM ranked
WHERE p.id = ranked.id
  AND p.best_ranking_position IS NULL;
