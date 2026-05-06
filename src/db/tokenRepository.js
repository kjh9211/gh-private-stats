const pool = require("./index");
const crypto = require("crypto");

function generatePublicToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function createToken(userId) {
  const publicToken = generatePublicToken();
  const { rows } = await pool.query(
    `INSERT INTO tokens (user_id, public_token)
     VALUES ($1, $2)
     RETURNING *`,
    [userId, publicToken]
  );
  return rows[0];
}

async function findTokenByValue(publicToken) {
  const { rows } = await pool.query(
    "SELECT * FROM tokens WHERE public_token = $1",
    [publicToken]
  );
  return rows[0] || null;
}

async function findTokensByUserId(userId) {
  const { rows } = await pool.query(
    "SELECT * FROM tokens WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  );
  return rows;
}

async function touchToken(publicToken) {
  await pool.query(
    "UPDATE tokens SET last_used_at = NOW() WHERE public_token = $1",
    [publicToken]
  );
}

async function deleteToken(publicToken, userId) {
  const { rowCount } = await pool.query(
    "DELETE FROM tokens WHERE public_token = $1 AND user_id = $2",
    [publicToken, userId]
  );
  return rowCount > 0;
}

module.exports = {
  createToken,
  findTokenByValue,
  findTokensByUserId,
  touchToken,
  deleteToken,
};
