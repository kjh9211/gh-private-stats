const { fetchAllRepos, fetchLanguagesForRepos } = require("./github");

/**
 * Aggregate language byte totals across all repos.
 *
 * Returns sorted array:
 *   [{ name: "JavaScript", bytes: 123456, percent: 42.1 }, ...]
 */
async function computeLanguageStats(accessToken, options = {}) {
  const {
    excludeForks = true,
    hideLangs = [],   // e.g. ["HTML", "CSS"]
    topN = 8,
  } = options;

  const repos = await fetchAllRepos(accessToken);
  const langMaps = await fetchLanguagesForRepos(accessToken, repos, { excludeForks });

  // Sum bytes per language
  const totals = {};
  for (const langMap of langMaps) {
    for (const [lang, bytes] of Object.entries(langMap)) {
      totals[lang] = (totals[lang] || 0) + bytes;
    }
  }

  // Remove hidden languages
  for (const lang of hideLangs) {
    delete totals[lang];
  }

  // Sort by bytes descending, take top N
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

module.exports = { computeLanguageStats };
