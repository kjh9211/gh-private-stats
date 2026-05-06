const pool = require("./index");

/**
 * Insert or update a user record after OAuth login.
 * The GitHub access_token is stored server-side and NEVER returned to the client.
 */
async function upsertUser({ githubId, username, accessToken, scope }) {
  const { rows } = await pool.query(
    `INSERT INTO users (github_id, username, access_token, scope, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (github_id) DO UPDATE
       SET username     = EXCLUDED.username,
           access_token = EXCLUDED.access_token,
           scope        = EXCLUDED.scope,
           updated_at   = NOW()
     RETURNING id, github_id, username, scope, created_at, updated_at`,
    [githubId, username, accessToken, scope]
  );
  return rows[0];
}

async function findUserById(id) {
  const { rows } = await pool.query(
    "SELECT id, github_id, username, access_token, scope FROM users WHERE id = $1",
    [id]
  );
  return rows[0] || null;
}

module.exports = { upsertUser, findUserById };
