-- Add repeat_weekly flag and parent_game_id chain link to games
ALTER TABLE games ADD COLUMN IF NOT EXISTS repeat_weekly boolean NOT NULL DEFAULT false;
ALTER TABLE games ADD COLUMN IF NOT EXISTS parent_game_id uuid REFERENCES games(id);
