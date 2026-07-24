PRAGMA foreign_keys = ON;

CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  preferred_locale TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE auth_identities (
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  verified_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (provider, provider_subject)
);

CREATE INDEX auth_identities_account_idx ON auth_identities(account_id);

CREATE TABLE account_sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE INDEX account_sessions_account_idx ON account_sessions(account_id);
CREATE INDEX account_sessions_expiry_idx ON account_sessions(expires_at);

CREATE TABLE auth_otp_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 5),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX auth_otp_expiry_idx ON auth_otp_codes(expires_at);

CREATE TABLE entitlements (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  source_provider TEXT NOT NULL,
  source_reference TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'refunded', 'revoked')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (source_provider, source_reference)
);

CREATE INDEX entitlements_account_product_idx
  ON entitlements(account_id, product_id, status);

ALTER TABLE challenges
  ADD COLUMN art_house TEXT NOT NULL DEFAULT 'van-gogh-house'
  CHECK (art_house IN ('van-gogh-house', 'monet-garden-house'));

ALTER TABLE challenges
  ADD COLUMN creator_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL;

CREATE INDEX challenges_art_house_feed_idx
  ON challenges(art_house, expires_at DESC, created_at DESC)
  WHERE public_token IS NOT NULL;

CREATE INDEX challenges_creator_idx
  ON challenges(creator_account_id, expires_at DESC)
  WHERE creator_account_id IS NOT NULL;
