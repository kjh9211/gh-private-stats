const pool = require("./index");

async function upsertUser({ githubId, username, accessToken, scope }) {
  const { rows } = await pool.query(
    `INSERT INTO users (github_id, username, access_token, scope, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (github_id) DO UPDATE
       SET username     = EXCLUDED.username,
           access_token = EXCLUDED.access_token,
           scope        = EXCLUDED.scope,
           updated_at   = NOW()
     RETURNING *`,
    [githubId, username, accessToken, scope]
  );
  return rows[0];
}

async function findUserById(id) {
  const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return rows[0] || null;
}

async function findUserByGithubId(githubId) {
  const { rows } = await pool.query(
    "SELECT * FROM users WHERE github_id = $1",
    [githubId]
  );
  return rows[0] || null;
}

module.exports = { upsertUser, findUserById, findUserByGithubId };
