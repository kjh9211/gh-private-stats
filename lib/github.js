const axios = require("axios");

const GITHUB_API = "https://api.github.com";
const CONCURRENCY = 10; // max parallel language-fetch requests

function makeClient(accessToken) {
  return axios.create({
    baseURL: GITHUB_API,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    timeout: 15000,
  });
}

/**
 * Fetch every repository the authenticated user owns.
 * Paginates automatically until all repos are collected.
 */
async function fetchAllRepos(accessToken) {
  const client = makeClient(accessToken);
  const repos = [];
  let page = 1;

  while (true) {
    const { data } = await client.get("/user/repos", {
      params: { per_page: 100, page, type: "owner", sort: "pushed" },
    });
    repos.push(...data);
    if (data.length < 100) break;
    page++;
  }

  return repos;
}

/**
 * Aggregate language byte totals across all owned repos.
 * Returns the FULL sorted list of { name, bytes, percent } — no filtering.
 *
 * Display options (hideLangs, topN) are intentionally NOT applied here so that
 * the cached result can be reused across requests with different query params.
 * Apply those filters in the route handler after cache retrieval.
 *
 * @param {string} accessToken  GitHub access token (never exposed to client)
 * @param {object} opts
 * @param {boolean} opts.excludeForks  Skip forked repos (default true)
 */
async function fetchLanguageStats(accessToken, opts = {}) {
  const { excludeForks = true } = opts;

  const repos = await fetchAllRepos(accessToken);
  const filtered = excludeForks ? repos.filter((r) => !r.fork) : repos;

  const totals = {};

  // Fetch language bytes in batches to avoid secondary rate-limit hits
  for (let i = 0; i < filtered.length; i += CONCURRENCY) {
    const batch = filtered.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((repo) =>
        makeClient(accessToken)
          .get(repo.languages_url, { baseURL: "" })
          .then((r) => r.data)
          .catch(() => ({}))
      )
    );

    for (const langMap of results) {
      for (const [lang, bytes] of Object.entries(langMap)) {
        totals[lang] = (totals[lang] || 0) + bytes;
      }
    }
  }

  // Return all languages sorted by byte count — no slice, no hide
  const grandTotal = Object.values(totals).reduce((s, b) => s + b, 0);

  return Object.entries(totals)
    .sort(([, a], [, b]) => b - a)
    .map(([name, bytes]) => ({
      name,
      bytes,
      percent: grandTotal > 0 ? (bytes / grandTotal) * 100 : 0,
    }));
}

module.exports = { fetchLanguageStats };
