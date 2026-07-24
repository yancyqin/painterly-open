ALTER TABLE challenges
  ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'visible'
  CHECK (moderation_status IN ('visible', 'hidden'));

CREATE TABLE challenge_reports (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('not_okay', 'broken', 'other')),
  created_at INTEGER NOT NULL
);

CREATE INDEX challenge_reports_challenge_idx
  ON challenge_reports(challenge_id);

CREATE INDEX challenges_public_moderation_idx
  ON challenges(moderation_status, expires_at DESC, created_at DESC)
  WHERE public_token IS NOT NULL;
