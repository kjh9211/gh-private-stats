const express = require("express");
const rateLimit = require("express-rate-limit");
const { findTokenByValue, touchToken } = require("../db/tokenRepository");
const { findUserById } = require("../db/userRepository");
const { fetchLanguageStats } = require("../lib/github");
const { getOrFetch } = require("../lib/cache");
const { renderSvg, errorSvg, LIGHT } = require("../lib/svg");

const router = express.Router();

const CACHE_TTL = parseInt(process.env.CACHE_TTL_SECONDS || "300");

// ── Rate limiters ─────────────────────────────────────────────────────────────
// Both return SVG error cards so README embeds degrade gracefully.

const ipLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_PER_IP || "60"),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  handler: (_req, res) =>
    sendSvgError(res, "Rate limit exceeded. Try again later.", 429),
});

const tokenLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_PER_TOKEN || "20"),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.query.token || req.ip,
  handler: (_req, res) =>
    sendSvgError(res, "Token rate limit exceeded. Try again later.", 429),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function sendSvg(res, svg, status = 200) {
  res
    .status(status)
    .set({
      "Content-Type":           "image/svg+xml; charset=utf-8",
      "Cache-Control":          `public, max-age=${CACHE_TTL}`,
      "X-Content-Type-Options": "nosniff",
    })
    .send(svg);
}

function sendSvgError(res, message, status = 400, theme) {
  res
    .status(status)
    .set({
      "Content-Type":  "image/svg+xml; charset=utf-8",
      "Cache-Control": "no-store",
    })
    .send(errorSvg(message, theme));
}

// ── GET /api/toplang ──────────────────────────────────────────────────────────
//
// Query params:
//   token  (required) — public token issued at /dashboard
//   theme              — "light" | "dark" (default: dark)
//   hide               — comma-separated language names to exclude (e.g. "HTML,CSS")
//   top                — number of languages to show (1-20, default 8)
//
// Returns image/svg+xml. The GitHub access token is NEVER exposed.
router.get("/toplang", ipLimiter, tokenLimiter, async (req, res) => {
  const { token, theme, hide, top } = req.query;
  const themeObj = theme === "light" ? LIGHT : undefined;

  // 1. Validate public token
  if (!token) {
    return sendSvgError(res, "Missing token parameter.", 400, themeObj);
  }

  const tokenRow = await findTokenByValue(token).catch(() => null);
  if (!tokenRow) {
    return sendSvgError(res, "Invalid or unknown token.", 401, themeObj);
  }

  // 2. Resolve user — GitHub access_token stays server-side
  const user = await findUserById(tokenRow.user_id).catch(() => null);
  if (!user) {
    return sendSvgError(res, "User not found.", 401, themeObj);
  }

  // 3. Parse options
  const hideLangs = hide
    ? hide.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const topN = Math.min(Math.max(parseInt(top || "8", 10) || 8, 1), 20);

  try {
    // 4. Fetch full raw stats (all languages) — layercache returns cached value when available.
    //    The cache key is user:${id}:stats (fixed per user), so one cached entry serves
    //    all query-param combinations. Display options are applied after retrieval.
    const allStats = await getOrFetch(user.id, () =>
      fetchLanguageStats(user.access_token, { excludeForks: true })
    );

    // 5. Build display data from raw cache — three explicit steps, always in order:
    //    ① hide  — remove languages the caller doesn't want
    //    ② top   — keep only the N highest-byte languages
    //    ③ percent — calculated from the final visible set (bytes sum = 100 %)
    const hidden  = allStats.filter((s) => !hideLangs.includes(s.name)); // ① hide
    const topped  = hidden.slice(0, topN);                                // ② top
    const total   = topped.reduce((sum, s) => sum + s.bytes, 0);
    const stats   = topped.map((s) => ({                                  // ③ percent
      name:    s.name,
      bytes:   s.bytes,
      percent: total > 0 ? (s.bytes / total) * 100 : 0,
    }));

    // 6. Update token's last_used_at (fire-and-forget; failure is non-fatal)
    touchToken(token).catch(() => {});

    // 7. Render and return SVG
    const svg = renderSvg(stats, { theme: theme === "light" ? "light" : "dark" });
    return sendSvg(res, svg);

  } catch (err) {
    console.error(`Stats fetch error for user ${user.id}:`, err.message);

    if (err.response?.status === 401) {
      return sendSvgError(res, "GitHub token expired. Please re-login.", 401, themeObj);
    }
    if (err.response?.status === 403) {
      return sendSvgError(res, "GitHub API rate limit hit. Retrying shortly.", 503, themeObj);
    }
    return sendSvgError(res, "Failed to load stats. Try again later.", 500, themeObj);
  }
});

module.exports = router;
