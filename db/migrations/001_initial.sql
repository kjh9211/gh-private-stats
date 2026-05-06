-- Users: stores GitHub OAuth access tokens server-side (never exposed to client)
CREATE TABLE IF NOT EXISTS users (
  id           SERIAL PRIMARY KEY,
  github_id    BIGINT UNIQUE NOT NULL,
  username     VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL,
  scope        VARCHAR(255),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tokens: public tokens issued to users for README embeds
-- These map to a user_id but NEVER expose the GitHub access_token
CREATE TABLE IF NOT EXISTS tokens (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_token VARCHAR(64) UNIQUE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tokens_public_token ON tokens(public_token);
CREATE INDEX IF NOT EXISTS idx_tokens_user_id      ON tokens(user_id);
