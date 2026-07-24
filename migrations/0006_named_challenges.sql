PRAGMA foreign_keys = ON;

-- This validation database has no retained player data. Old challenges do not
-- have a safe room name, so start the named-room experiment with a clean TTL set.
DELETE FROM challenges;

ALTER TABLE challenges
  ADD COLUMN room_name TEXT NOT NULL DEFAULT 'Sunny Garden';

ALTER TABLE challenges
  ADD COLUMN room_name_search TEXT NOT NULL DEFAULT 'sunny garden';

CREATE INDEX challenges_room_name_search_idx
  ON challenges(moderation_status, room_name_search, expires_at DESC, created_at DESC)
  WHERE public_token IS NOT NULL;
