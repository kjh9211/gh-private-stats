const express = require("express");
const { findTokenByValue, touchToken } = require("../db/tokenRepository");
const { findUserById } = require("../db/userRepository");
const { computeLanguageStats } = require("../services/stats");
const { getOrFetch } = require("../services/cache");
const { renderSvg, errorSvg, lightTheme } = require("../services/svg");
const { imageLimiter, tokenLimiter } = require("../middleware/rateLimit");

const router = express.Router();

/**
 * GET /api/toplang?token=PUBLIC_TOKEN[&theme=light][&hide=HTML,CSS][&top=6]
 *
 * Returns an SVG image with top language statistics.
 * GitHub's camo proxy and markdown renderers expect image/svg+xml.
 */
router.get(
  "/toplang",
  imageLimiter,
  tokenLimiter,
  async (req, res) => {
    const { token, theme, hide, top } = req.query;

    const sendSvg = (svg, status = 200) =>
      res
        .status(status)
        .set({
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": `public, max-age=${process.env.CACHE_TTL_SECONDS || 300}`,
          // Tell GitHub camo not to strip our SVG
          "X-Content-Type-Options": "nosniff",
        })
        .send(svg);

    const sendError = (msg, status = 400) => {
      const t = theme === "light" ? lightTheme : undefined;
      sendSvg(errorSvg(msg, t), status);
    };

    // 1. Validate public token
    if (!token) {
      return sendError("Missing token parameter.");
    }

    const tokenRow = await findTokenByValue(token).catch(() => null);
    if (!tokenRow) {
      return sendError("Invalid or unknown token.", 401);
    }

    // 2. Resolve user (access_token stays server-side)
    const user = await findUserById(tokenRow.user_id).catch(() => null);
    if (!user) {
      return sendError("User not found.", 401);
    }

    // 3. Parse options
    const hideLangs = hide
      ? hide
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const topN = Math.min(Math.max(parseInt(top || "8", 10) || 8, 1), 20);
    const themeOpt = theme === "light" ? "light" : "dark";

    try {
      // 4. Check cache (layercache: memory → Redis)
      const stats = await getOrFetch(user.id, () =>
        computeLanguageStats(user.access_token, {
          excludeForks: true,
          hideLangs,
          topN,
        })
      );

      // 5. Update last_used_at (fire-and-forget)
      touchToken(token).catch(() => {});

      // 6. Render SVG
      const svg = renderSvg(stats, { theme: themeOpt });
      return sendSvg(svg);
    } catch (err) {
      console.error(`Stats fetch failed for user ${user.id}:`, err.message);

      // GitHub API rate limit → instruct to retry after cache serves stale data
      if (err.response?.status === 403) {
        return sendError("GitHub API rate limit reached. Cached data may be stale.", 503);
      }
      // Expired / revoked GitHub token
      if (err.response?.status === 401) {
        return sendError("GitHub token expired. Please re-login.", 401);
      }

      return sendError("Failed to fetch stats. Please try again later.", 500);
    }
  }
);

module.exports = router;
