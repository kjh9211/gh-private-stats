const express = require("express");
const axios = require("axios");
const { upsertUser } = require("../db/userRepository");

const router = express.Router();

const GITHUB_OAUTH_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";

// Step 1: Redirect to GitHub OAuth
router.get("/login", (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    scope: "repo",
    state: generateState(),
  });

  // Store state in session for CSRF protection
  req.session.oauthState = params.get("state");

  res.redirect(`${GITHUB_OAUTH_URL}?${params.toString()}`);
});

// Step 2: GitHub callback — exchange code for access_token
router.get("/callback", async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).send("Missing code parameter.");
  }

  if (state !== req.session.oauthState) {
    return res.status(403).send("OAuth state mismatch. Possible CSRF attack.");
  }
  delete req.session.oauthState;

  try {
    // Exchange code for access_token
    const tokenRes = await axios.post(
      GITHUB_TOKEN_URL,
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      { headers: { Accept: "application/json" } }
    );

    const { access_token, scope, error } = tokenRes.data;

    if (error || !access_token) {
      console.error("GitHub token error:", tokenRes.data);
      return res.status(400).send("Failed to obtain access token from GitHub.");
    }

    // Fetch GitHub user info
    const userRes = await axios.get(GITHUB_USER_URL, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/vnd.github+json",
      },
    });

    const { id: githubId, login: username } = userRes.data;

    // Upsert user in DB (access_token stored server-side only)
    const user = await upsertUser({ githubId, username, accessToken: access_token, scope });

    // Set session
    req.session.userId = user.id;
    req.session.username = user.username;

    res.redirect("/dashboard");
  } catch (err) {
    console.error("OAuth callback error:", err.message);
    res.status(500).send("Authentication failed. Please try again.");
  }
});

// Logout
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

function generateState() {
  const { randomBytes } = require("crypto");
  return randomBytes(16).toString("hex");
}

module.exports = router;
