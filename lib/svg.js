// GitHub-style language colour palette (fallback: #8b949e)
const LANG_COLORS = {
  JavaScript:  "#f1e05a",
  TypeScript:  "#3178c6",
  Python:      "#3572A5",
  Java:        "#b07219",
  Go:          "#00ADD8",
  Rust:        "#dea584",
  "C++":       "#f34b7d",
  C:           "#555555",
  "C#":        "#178600",
  PHP:         "#4F5D95",
  Ruby:        "#701516",
  Swift:       "#F05138",
  Kotlin:      "#A97BFF",
  Scala:       "#c22d40",
  HTML:        "#e34c26",
  CSS:         "#563d7c",
  Shell:       "#89e051",
  Dockerfile:  "#384d54",
  Makefile:    "#427819",
  Lua:         "#000080",
  R:           "#198CE7",
  Dart:        "#00B4AB",
  Elixir:      "#6e4a7e",
  Haskell:     "#5e5086",
  OCaml:       "#3be133",
  Nix:         "#7e7eff",
  Vue:         "#41b883",
  Svelte:      "#ff3e00",
  Astro:       "#ff5a03",
};

const DARK = {
  bg:      "#161b22",
  border:  "#30363d",
  text:    "#e6edf3",
  subtext: "#8b949e",
};

const LIGHT = {
  bg:      "#ffffff",
  border:  "#d0d7de",
  text:    "#1f2328",
  subtext: "#57606a",
};

function langColor(name) {
  return LANG_COLORS[name] || "#8b949e";
}

function escXml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Render language statistics as an SVG card.
 *
 * @param {Array<{name:string, bytes:number, percent:number}>} stats
 * @param {{ theme?: "dark"|"light", title?: string }} opts
 * @returns {string} Complete SVG markup
 */
function renderSvg(stats, opts = {}) {
  const theme  = opts.theme === "light" ? LIGHT : DARK;
  const title  = opts.title || "Most Used Languages";

  if (!stats || stats.length === 0) {
    return errorSvg("No language data found.", theme);
  }

  const WIDTH      = 380;
  const PADDING    = 20;
  const HEADER_H   = 44;
  const ROW_H      = 28;
  const FOOTER_H   = 20;
  const BAR_START  = 120;
  const BAR_MAX_W  = WIDTH - BAR_START - PADDING - 36;
  const DOT_R      = 5;

  const height = HEADER_H + stats.length * ROW_H + FOOTER_H;

  const rows = stats
    .map((lang, i) => {
      const midY    = HEADER_H + i * ROW_H + ROW_H / 2;
      const barW    = Math.max(2, Math.round((lang.percent / 100) * BAR_MAX_W));
      const pct     = lang.percent.toFixed(1);
      const col     = langColor(lang.name);

      return `
  <circle cx="${PADDING + DOT_R}" cy="${midY}" r="${DOT_R}" fill="${col}"/>
  <text x="${PADDING + DOT_R * 2 + 6}" y="${midY}" font-size="11"
        fill="${theme.text}" dominant-baseline="middle"
        font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">${escXml(lang.name)}</text>
  <rect x="${BAR_START}" y="${midY - 5}" width="${barW}" height="9"
        rx="4" fill="${col}" opacity="0.88"/>
  <text x="${WIDTH - PADDING}" y="${midY}" font-size="10"
        fill="${theme.subtext}" text-anchor="end" dominant-baseline="middle"
        font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">${pct}%</text>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg"
     width="${WIDTH}" height="${height}"
     viewBox="0 0 ${WIDTH} ${height}"
     role="img" aria-label="${escXml(title)}">
  <title>${escXml(title)}</title>
  <rect width="${WIDTH}" height="${height}" rx="10"
        fill="${theme.bg}" stroke="${theme.border}" stroke-width="1"/>
  <text x="${PADDING}" y="28" font-size="14" font-weight="600"
        fill="${theme.text}"
        font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">${escXml(title)}</text>
  <line x1="${PADDING}" y1="40" x2="${WIDTH - PADDING}" y2="40"
        stroke="${theme.border}" stroke-width="1"/>
  ${rows}
</svg>`;
}

/**
 * Render a compact SVG error card.
 *
 * @param {string} message
 * @param {object} [theme]
 * @returns {string}
 */
function errorSvg(message, theme = DARK) {
  const WIDTH = 380, HEIGHT = 76;
  return `<svg xmlns="http://www.w3.org/2000/svg"
     width="${WIDTH}" height="${HEIGHT}"
     viewBox="0 0 ${WIDTH} ${HEIGHT}"
     role="img" aria-label="Error">
  <rect width="${WIDTH}" height="${HEIGHT}" rx="10"
        fill="${theme.bg}" stroke="${theme.border}" stroke-width="1"/>
  <text x="20" y="44" font-size="13" fill="#f85149"
        font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    &#9888; ${escXml(message)}
  </text>
</svg>`;
}

module.exports = { renderSvg, errorSvg, DARK, LIGHT };
