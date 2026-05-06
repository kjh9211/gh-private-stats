const express = require("express");
const { requireAuth } = require("../lib/jwt");
const { createToken, findTokensByUserId, deleteToken } = require("../db/tokenRepository");

const router = express.Router();

// ── GET / ─────────────────────────────────────────────────────────────────────
router.get("/", (req, res) => {
  res.send(landingHtml());
});

// ── GET /dashboard ────────────────────────────────────────────────────────────
router.get("/dashboard", requireAuth, async (req, res) => {
  const tokens = await findTokensByUserId(req.user.userId);
  const base   = `${req.protocol}://${req.get("host")}`;
  res.send(dashboardHtml(req.user.username, tokens, base));
});

// ── POST /dashboard/tokens ────────────────────────────────────────────────────
router.post("/dashboard/tokens", requireAuth, async (req, res) => {
  await createToken(req.user.userId);
  res.redirect("/dashboard");
});

// ── POST /dashboard/tokens/revoke ─────────────────────────────────────────────
router.post("/dashboard/tokens/revoke", requireAuth, async (req, res) => {
  const { token } = req.body;
  if (token) {
    await deleteToken(token, req.user.userId);
  }
  res.redirect("/dashboard");
});

// ── HTML helpers ──────────────────────────────────────────────────────────────

function landingHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>GitHub Stats Image</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
         background:#0d1117;color:#e6edf3;display:flex;
         justify-content:center;align-items:center;min-height:100vh}
    .card{background:#161b22;border:1px solid #30363d;border-radius:12px;
          padding:48px 40px;text-align:center;max-width:440px;width:100%}
    h1{font-size:1.6rem;margin-bottom:12px}
    p{color:#8b949e;line-height:1.6;margin-bottom:32px}
    a.btn{display:inline-block;padding:12px 28px;background:#238636;
          color:#fff;text-decoration:none;border-radius:6px;font-weight:600;
          transition:background .2s}
    a.btn:hover{background:#2ea043}
    .icon{font-size:3rem;margin-bottom:20px}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">🐙</div>
    <h1>GitHub Stats Image</h1>
    <p>Display your top programming languages — including private repos — directly in your GitHub README.</p>
    <a class="btn" href="/auth/login">Sign in with GitHub</a>
  </div>
</body>
</html>`;
}

function dashboardHtml(username, tokens, base) {
  const tokenRows = tokens.length
    ? tokens
        .map(
          (t) => `
        <tr>
          <td><code>${escHtml(t.public_token)}</code></td>
          <td>${t.last_used_at ? new Date(t.last_used_at).toLocaleString() : "Never"}</td>
          <td>${new Date(t.created_at).toLocaleDateString()}</td>
          <td>
            <form method="POST" action="/dashboard/tokens/revoke" style="display:inline">
              <input type="hidden" name="token" value="${escHtml(t.public_token)}"/>
              <button type="submit" class="btn-danger">Revoke</button>
            </form>
          </td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="4" style="text-align:center;color:#8b949e;padding:20px">No tokens yet</td></tr>`;

  const embed =
    tokens.length > 0
      ? `![Top Langs](${base}/api/toplang?token=${tokens[0].public_token})`
      : `![Top Langs](${base}/api/toplang?token=YOUR_TOKEN)`;

  const preview = tokens.length > 0
    ? `<div class="card">
        <h2>Live Preview</h2>
        <div style="margin-top:12px">
          <img src="/api/toplang?token=${escHtml(tokens[0].public_token)}"
               alt="Top Languages" style="max-width:100%;border-radius:8px"/>
        </div>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Dashboard — GitHub Stats</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
         background:#0d1117;color:#e6edf3;padding:32px 16px}
    .wrap{max-width:860px;margin:0 auto}
    header{display:flex;justify-content:space-between;align-items:center;margin-bottom:32px}
    h1{font-size:1.4rem}
    .meta{color:#8b949e;font-size:.9rem}
    form.logout button{background:none;border:1px solid #30363d;color:#e6edf3;
      padding:6px 14px;border-radius:6px;cursor:pointer;font-size:.85rem}
    form.logout button:hover{border-color:#6e7681}
    .card{background:#161b22;border:1px solid #30363d;border-radius:10px;
          padding:24px;margin-bottom:24px}
    h2{font-size:.78rem;margin-bottom:16px;color:#8b949e;
       text-transform:uppercase;letter-spacing:.06em}
    table{width:100%;border-collapse:collapse;font-size:.875rem}
    th,td{padding:10px 12px;border-bottom:1px solid #21262d;text-align:left}
    th{color:#8b949e;font-weight:500}
    code{background:#21262d;padding:2px 8px;border-radius:4px;
         font-size:.78rem;word-break:break-all}
    .btn-danger{background:none;border:1px solid #f85149;color:#f85149;
      padding:4px 12px;border-radius:6px;cursor:pointer;font-size:.8rem}
    .btn-danger:hover{background:#f85149;color:#fff}
    .btn-create{background:#238636;color:#fff;border:none;
      padding:10px 20px;border-radius:6px;cursor:pointer;font-weight:600;margin-top:16px}
    .btn-create:hover{background:#2ea043}
    pre{background:#21262d;border-radius:6px;padding:14px 16px;
        overflow:auto;font-size:.85rem;color:#79c0ff;line-height:1.5}
  </style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>🐙 GitHub Stats</h1>
    <div style="display:flex;align-items:center;gap:16px">
      <span class="meta">@${escHtml(username)}</span>
      <form class="logout" method="POST" action="/auth/logout">
        <button type="submit">Sign out</button>
      </form>
    </div>
  </header>

  <div class="card">
    <h2>Your Tokens</h2>
    <table>
      <thead>
        <tr><th>Token</th><th>Last Used</th><th>Created</th><th></th></tr>
      </thead>
      <tbody>${tokenRows}</tbody>
    </table>
    <form method="POST" action="/dashboard/tokens">
      <button class="btn-create" type="submit">+ Generate New Token</button>
    </form>
  </div>

  <div class="card">
    <h2>README Embed</h2>
    <pre>${escHtml(embed)}</pre>
    <p style="margin-top:10px;font-size:.8rem;color:#8b949e">
      Add <code>?theme=light</code>, <code>&amp;hide=HTML,CSS</code>, or <code>&amp;top=6</code> as needed.
    </p>
  </div>

  ${preview}
</div>
</body>
</html>`;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = router;
