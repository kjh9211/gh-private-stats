const axios = require("axios");

const GITHUB_API = "https://api.github.com";

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
 * Fetch all repositories the authenticated user owns or is a member of.
 * Handles pagination automatically.
 */
async function fetchAllRepos(accessToken) {
  const client = makeClient(accessToken);
  const repos = [];
  let page = 1;

  while (true) {
    const { data } = await client.get("/user/repos", {
      params: {
        per_page: 100,
        page,
        // 'all' includes private + public repos the user has access to
        type: "owner",
        sort: "pushed",
      },
    });

    repos.push(...data);

    if (data.length < 100) break;
    page++;
  }

  return repos;
}

/**
 * Fetch language byte counts for a single repo.
 * Returns an object like { JavaScript: 12345, TypeScript: 6789 }
 */
async function fetchRepoLanguages(accessToken, languagesUrl) {
  const client = makeClient(accessToken);
  const { data } = await client.get(languagesUrl, { baseURL: "" });
  return data;
}

/**
 * Fetch languages for all repos concurrently (with a concurrency cap).
 */
async function fetchLanguagesForRepos(accessToken, repos, { excludeForks = true } = {}) {
  const filtered = excludeForks ? repos.filter((r) => !r.fork) : repos;

  // Cap concurrency to avoid hitting secondary rate limits
  const CONCURRENCY = 10;
  const results = [];

  for (let i = 0; i < filtered.length; i += CONCURRENCY) {
    const batch = filtered.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((repo) =>
        fetchRepoLanguages(accessToken, repo.languages_url).catch(() => ({}))
      )
    );
    results.push(...batchResults);
  }

  return results;
}

module.exports = { fetchAllRepos, fetchLanguagesForRepos };
