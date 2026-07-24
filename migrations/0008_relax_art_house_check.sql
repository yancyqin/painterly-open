PRAGMA foreign_keys = OFF;

-- Migration 0005 pinned art_house to a two-value CHECK. New art houses
-- (outdoor-masters-journey, world-remembers-color) were later added in code, so
-- publishing them now fails with "CHECK constraint failed: art_house IN (...)".
-- SQLite can't drop a column CHECK in place, so rebuild the challenges table
-- without it. art_house values are already validated at the edge by ART_HOUSES
-- in core.js (the single source of truth), so no DB-level list to keep in sync.
--
-- This validation database has disposable, 24-hour data. Drop the challenge
-- tables (children first for FK order) and recreate them; accounts/sessions and
-- the moderation_audit log are untouched.

DROP TABLE IF EXISTS attempts;
DROP TABLE IF EXISTS challenge_reports;
DROP TABLE IF EXISTS challenges;

CREATE TABLE challenges (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  hider_key_hash TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  public_token TEXT,
  moderation_status TEXT NOT NULL DEFAULT 'visible'
    CHECK (moderation_status IN ('visible', 'hidden')),
  moderation_reviewed_at INTEGER,
  art_house TEXT NOT NULL DEFAULT 'van-gogh-house',
  creator_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  room_name TEXT NOT NULL DEFAULT 'Sunny Garden',
  room_name_search TEXT NOT NULL DEFAULT 'sunny garden',
  preview_image TEXT,
  last_found_image TEXT,
  last_found_at INTEGER,
  CHECK (expires_at = created_at + 86400)
);

CREATE INDEX challenges_expiry_idx ON challenges(expires_at);
CREATE UNIQUE INDEX challenges_public_token_idx
  ON challenges(public_token) WHERE public_token IS NOT NULL;
CREATE INDEX challenges_public_feed_idx
  ON challenges(expires_at DESC, created_at DESC) WHERE public_token IS NOT NULL;
CREATE INDEX challenges_public_moderation_idx
  ON challenges(moderation_status, expires_at DESC, created_at DESC) WHERE public_token IS NOT NULL;
CREATE INDEX challenges_moderation_queue_idx
  ON challenges(moderation_status, moderation_reviewed_at, expires_at DESC) WHERE public_token IS NOT NULL;
CREATE INDEX challenges_art_house_feed_idx
  ON challenges(art_house, expires_at DESC, created_at DESC) WHERE public_token IS NOT NULL;
CREATE INDEX challenges_creator_idx
  ON challenges(creator_account_id, expires_at DESC) WHERE creator_account_id IS NOT NULL;
CREATE INDEX challenges_room_name_search_idx
  ON challenges(moderation_status, room_name_search, expires_at DESC, created_at DESC) WHERE public_token IS NOT NULL;

CREATE TABLE attempts (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  found INTEGER NOT NULL CHECK (found IN (0, 1)),
  elapsed_ms INTEGER NOT NULL CHECK (elapsed_ms >= 0 AND elapsed_ms <= 600000),
  created_at INTEGER NOT NULL
);
CREATE INDEX attempts_challenge_idx ON attempts(challenge_id);

CREATE TABLE challenge_reports (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('not_okay', 'broken', 'other')),
  created_at INTEGER NOT NULL
);
CREATE INDEX challenge_reports_challenge_idx ON challenge_reports(challenge_id);

PRAGMA foreign_keys = ON;
