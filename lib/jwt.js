const jwt = require("jsonwebtoken");

const COOKIE_NAME = "gh_stats_jwt";
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (ms)
  path: "/",
};

function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET env var is not set");
  return s;
}

function sign(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: "7d" });
}

function verify(token) {
  return jwt.verify(token, getSecret());
}

/**
 * Extract and verify the JWT from the request's cookie.
 * Returns the decoded payload or null if absent / invalid.
 */
function fromRequest(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    return verify(token);
  } catch {
    return null;
  }
}

/**
 * Express middleware: attach decoded JWT payload to req.user.
 * Responds with 401 if token is missing or invalid.
 */
function requireAuth(req, res, next) {
  const payload = fromRequest(req);
  if (!payload) {
    return res.redirect("/");
  }
  req.user = payload;
  next();
}

module.exports = { sign, verify, fromRequest, requireAuth, COOKIE_NAME, COOKIE_OPTIONS };
