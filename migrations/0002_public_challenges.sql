ALTER TABLE challenges ADD COLUMN public_token TEXT;

CREATE UNIQUE INDEX challenges_public_token_idx
  ON challenges(public_token)
  WHERE public_token IS NOT NULL;

CREATE INDEX challenges_public_feed_idx
  ON challenges(expires_at DESC, created_at DESC)
  WHERE public_token IS NOT NULL;
