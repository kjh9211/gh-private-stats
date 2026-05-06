const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const { upsertUser } = require("../db/userRepository");
const { sign, COOKIE_NAME, COOKIE_OPTIONS } = require("../lib/jwt");

const router = express.Router();

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL     = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL      = "https://api.github.com/user";

const STATE_COOKIE     = "oauth_state";
const STATE_COOKIE_MAX = 10 * 60 * 1000; // 10 minutes

// ── GET /auth/login ───────────────────────────────────────────────────────────
// Redirect the browser to GitHub's OAuth authorization page.
router.get("/login", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");

  // Store state in a short-lived httpOnly cookie for CSRF validation on callback
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: STATE_COOKIE_MAX,
  });

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    scope: "repo",
    state,
  });

  res.redirect(`${GITHUB_AUTHORIZE_URL}?${params.toString()}`);
});

// ── GET /auth/callback ────────────────────────────────────────────────────────
// GitHub redirects here with ?code=...&state=...
// Exchange the code for an access_token, store it server-side, issue a JWT.
router.get("/callback", async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).send("Missing OAuth code.");
  }

  // CSRF check — state must match what we stored in the cookie
  const storedState = req.cookies?.[STATE_COOKIE];
  if (!storedState || state !== storedState) {
    return res.status(403).send("OAuth state mismatch. Possible CSRF attack.");
  }
  res.clearCookie(STATE_COOKIE);

  try {
    // Step 1: Exchange code → GitHub access_token
    const tokenRes = await axios.post(
      GITHUB_TOKEN_URL,
      {
        client_id:     process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      { headers: { Accept: "application/json" } }
    );

    const { access_token, scope, error, error_description } = tokenRes.data;

    if (error || !access_token) {
      console.error("GitHub token exchange failed:", error, error_description);
      return res.status(400).send("Failed to obtain access token from GitHub.");
    }

    // Step 2: Fetch the authenticated user's profile
    const userRes = await axios.get(GITHUB_USER_URL, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/vnd.github+json",
      },
    });

    const { id: githubId, login: username } = userRes.data;

    // Step 3: Persist user in DB — access_token is stored server-side ONLY
    const user = await upsertUser({ githubId, username, accessToken: access_token, scope });

    // Step 4: Issue a signed JWT (contains userId + username, NOT the GitHub token)
    const jwtToken = sign({ userId: user.id, username: user.username });
    res.cookie(COOKIE_NAME, jwtToken, COOKIE_OPTIONS);

    res.redirect("/dashboard");
  } catch (err) {
    console.error("OAuth callback error:", err.message);
    res.status(500).send("Authentication failed. Please try again.");
  }
});

// ── POST /auth/logout ─────────────────────────────────────────────────────────
router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.redirect("/");
});

module.exports = router;
