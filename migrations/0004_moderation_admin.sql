ALTER TABLE challenges
  ADD COLUMN moderation_reviewed_at INTEGER;

CREATE TABLE moderation_audit (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('restore', 'confirm_hidden')),
  report_count INTEGER NOT NULL CHECK (report_count >= 0),
  reasons_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX moderation_audit_created_idx
  ON moderation_audit(created_at DESC);

CREATE INDEX moderation_audit_challenge_idx
  ON moderation_audit(challenge_id, created_at DESC);

CREATE INDEX challenges_moderation_queue_idx
  ON challenges(moderation_status, moderation_reviewed_at, expires_at DESC)
  WHERE public_token IS NOT NULL;
