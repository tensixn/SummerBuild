-- Trigger: immediately flip open ↔ full when players join or leave
CREATE OR REPLACE FUNCTION update_game_fullness()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_game_id UUID;
  v_max_players INTEGER;
  v_current_status TEXT;
  v_count INTEGER;
BEGIN
  v_game_id := COALESCE(NEW.game_id, OLD.game_id);
  IF v_game_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT max_players, status INTO v_max_players, v_current_status
  FROM games WHERE id = v_game_id;

  -- Only manage fullness for pre-game states
  IF v_current_status NOT IN ('open', 'full') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COUNT(*) INTO v_count FROM game_participants WHERE game_id = v_game_id;

  IF v_count >= v_max_players THEN
    UPDATE games SET status = 'full' WHERE id = v_game_id AND status = 'open';
  ELSE
    UPDATE games SET status = 'open' WHERE id = v_game_id AND status = 'full';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_game_fullness ON game_participants;
CREATE TRIGGER trg_game_fullness
AFTER INSERT OR DELETE ON game_participants
FOR EACH ROW EXECUTE FUNCTION update_game_fullness();

-- pg_cron: call game-lifecycle edge function every minute
-- Requires pg_cron and pg_net extensions (enabled by default on Supabase Pro)
SELECT cron.schedule(
  'game-lifecycle-cron',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://zfefmkkcijiidfgwjmsm.supabase.co/functions/v1/game-lifecycle',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpmZWZta2tjaWppaWRmZ3dqbXNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NjUxMTMsImV4cCI6MjA5NjA0MTExM30.8MP_0wrev1fbwdr1zrj_2GzC6G0wTD5gTCHpqohNOlU"}'::jsonb,
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
