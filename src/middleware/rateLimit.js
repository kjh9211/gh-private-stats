const rateLimit = require("express-rate-limit");
const { errorSvg } = require("../services/svg");

/**
 * Per-IP rate limiter for the public image API.
 * Returns an SVG error card instead of JSON so README embeds degrade gracefully.
 */
const imageLimiter = rateLimit({
  windowMs: 60 * 1000,      // 1 minute window
  max: parseInt(process.env.RATE_LIMIT_PER_IP || "60"),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    const svg = errorSvg("Rate limit exceeded. Try again later.");
    res
      .status(429)
      .set({
        "Content-Type": "image/svg+xml",
        "Cache-Control": "no-store",
      })
      .send(svg);
  },
});

/**
 * Per-token rate limiter — prevents a single README from hammering the API
 * (GitHub's camo proxy can amplify requests).
 */
const tokenLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_PER_TOKEN || "20"),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.query.token || req.ip,
  handler: (req, res) => {
    const svg = errorSvg("Token rate limit exceeded. Try again later.");
    res
      .status(429)
      .set({
        "Content-Type": "image/svg+xml",
        "Cache-Control": "no-store",
      })
      .send(svg);
  },
});

module.exports = { imageLimiter, tokenLimiter };
