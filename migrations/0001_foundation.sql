PRAGMA foreign_keys = ON;

CREATE TABLE challenges (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  hider_key_hash TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  CHECK (expires_at = created_at + 86400)
);

CREATE INDEX challenges_expiry_idx ON challenges(expires_at);

CREATE TABLE attempts (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  found INTEGER NOT NULL CHECK (found IN (0, 1)),
  elapsed_ms INTEGER NOT NULL CHECK (elapsed_ms >= 0 AND elapsed_ms <= 600000),
  created_at INTEGER NOT NULL
);

CREATE INDEX attempts_challenge_idx ON attempts(challenge_id);
