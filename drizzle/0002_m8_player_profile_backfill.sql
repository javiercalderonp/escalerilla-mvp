UPDATE players
SET
  first_name = SPLIT_PART(full_name, ' ', 1),
  last_name = NULLIF(TRIM(SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)), '')
WHERE first_name IS NULL;

UPDATE players
SET last_name = full_name
WHERE last_name IS NULL OR last_name = '';

UPDATE players
SET joined_ladder_on = created_at::date
WHERE joined_ladder_on IS NULL;

UPDATE players
SET visibility = '{"phone":"players","rut":"admin","birthDate":"private"}'::jsonb
WHERE visibility IS NULL;

ALTER TABLE players
  ALTER COLUMN first_name SET NOT NULL,
  ALTER COLUMN last_name SET NOT NULL,
  ALTER COLUMN joined_ladder_on SET NOT NULL,
  ALTER COLUMN visibility SET NOT NULL;
