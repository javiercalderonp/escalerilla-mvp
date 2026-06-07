DO $$ BEGIN
 ALTER TABLE "matches"
 ADD CONSTRAINT "matches_distinct_players_check"
 CHECK ("player1_id" <> "player2_id");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
