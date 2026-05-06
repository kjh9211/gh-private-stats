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
 * Aggregate language byte totals across all non-fork repos.
 * Returns a sorted array of { name, bytes, percent }.
 *
 * @param {string} accessToken  GitHub access token (never exposed to client)
 * @param {object} opts
 * @param {boolean} opts.excludeForks  Skip forked repos (default true)
 * @param {string[]} opts.hideLangs   Languages to exclude from output
 * @param {number} opts.topN          Maximum number of languages to return
 */
async function fetchLanguageStats(accessToken, opts = {}) {
  const { excludeForks = true, hideLangs = [], topN = 8 } = opts;

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

  for (const lang of hideLangs) delete totals[lang];

  const sorted = Object.entries(totals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, topN);

  const grandTotal = sorted.reduce((sum, [, b]) => sum + b, 0);

  return sorted.map(([name, bytes]) => ({
    name,
    bytes,
    percent: grandTotal > 0 ? (bytes / grandTotal) * 100 : 0,
  }));
}

module.exports = { fetchLanguageStats };
