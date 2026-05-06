const express = require("express");
const rateLimit = require("express-rate-limit");
const { findTokenByValue, touchToken } = require("../db/tokenRepository");
const { findUserById } = require("../db/userRepository");
const { fetchLanguageStats } = require("../lib/github");
const { getOrFetch } = require("../lib/cache");
const { renderSvg, errorSvg, LIGHT } = require("../lib/svg");

const router = express.Router();

const CACHE_TTL = parseInt(process.env.CACHE_TTL_SECONDS || "300");

// ── Rate limiter ──────────────────────────────────────────────────────────────
// Only token-based limiting is applied to /api/toplang.
//
// IP-based limiting is intentionally NOT used here because GitHub proxies all
// README image requests through camo.githubusercontent.com (a small pool of
// shared AWS IPs). An IP limiter would aggregate traffic from every user whose
// README embeds this service and trigger false positives.
//
// The token limiter is the correct unit: each public_token belongs to one user,
// so it naturally isolates per-user traffic regardless of the requesting IP.
const tokenLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_PER_TOKEN || "30"),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.query.token || req.ip,
  handler: (_req, res) =>
    sendSvgError(res, "Rate limit exceeded. Try again later.", 429),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function sendSvg(res, svg, status = 200) {
  // s-maxage: tells Vercel Edge Network and GitHub's camo proxy how long to
  //           cache this response at the CDN layer (shared cache TTL).
  // Expires:  HTTP/1.0 fallback; camo and some intermediate proxies prefer it.
  const expires = new Date(Date.now() + CACHE_TTL * 1000).toUTCString();
  res
    .status(status)
    .set({
      "Content-Type":           "image/svg+xml; charset=utf-8",
      "Cache-Control":          `public, max-age=${CACHE_TTL}, s-maxage=${CACHE_TTL}`,
      "Expires":                expires,
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
router.get("/toplang", tokenLimiter, async (req, res) => {
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

    // 5. Build display data — four explicit steps, always in this order:
    //    ① sort    — bytes descending (route owns sort; never relies on cache order)
    //    ② hide    — remove languages the caller doesn't want
    //    ③ top     — keep only the N highest-byte entries
    //    ④ percent — recalculated from the final visible set (always sums to 100 %)
    const sorted  = [...allStats].sort((a, b) => b.bytes - a.bytes);     // ① sort
    const hidden  = sorted.filter((s) => !hideLangs.includes(s.name));   // ② hide
    const topped  = hidden.slice(0, topN);                                // ③ top
    const total   = topped.reduce((sum, s) => sum + s.bytes, 0);
    const stats   = topped.map((s) => ({                                  // ④ percent
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
