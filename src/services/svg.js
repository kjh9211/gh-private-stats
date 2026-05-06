// GitHub-style language colours (subset — fallback to #8b949e)
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
  Vim:         "#199f4b",
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

function color(name) {
  return LANG_COLORS[name] || "#8b949e";
}

/**
 * Render language stats as an SVG card.
 *
 * @param {Array<{name:string, bytes:number, percent:number}>} stats
 * @param {{ theme?: 'dark'|'light', title?: string }} opts
 * @returns {string} SVG markup
 */
function renderSvg(stats, opts = {}) {
  const theme = opts.theme === "light" ? lightTheme : darkTheme;
  const title = opts.title || "Most Used Languages";

  if (!stats || stats.length === 0) {
    return errorSvg("No language data found.", theme);
  }

  const ROW_HEIGHT = 28;
  const PADDING    = 20;
  const BAR_Y_OFFSET = 16;
  const HEADER_H   = 44;
  const FOOTER_H   = 24;
  const WIDTH      = 380;

  const height = HEADER_H + stats.length * ROW_HEIGHT + FOOTER_H + PADDING;

  const rows = stats
    .map((lang, i) => {
      const y = HEADER_H + i * ROW_HEIGHT;
      const barWidth = Math.max(2, Math.round((lang.percent / 100) * (WIDTH - 120)));
      const pct = lang.percent.toFixed(1);

      return `
    <!-- ${lang.name} -->
    <circle cx="26" cy="${y + BAR_Y_OFFSET - 4}" r="5" fill="${color(lang.name)}"/>
    <text x="36" y="${y + BAR_Y_OFFSET}" font-size="11" fill="${theme.text}"
          font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
          dominant-baseline="middle">${escXml(lang.name)}</text>
    <rect x="120" y="${y + BAR_Y_OFFSET - 7}" width="${barWidth}" height="9"
          rx="4" fill="${color(lang.name)}" opacity="0.9"/>
    <text x="${WIDTH - 6}" y="${y + BAR_Y_OFFSET}" font-size="10"
          fill="${theme.subtext}" text-anchor="end"
          font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"
          dominant-baseline="middle">${pct}%</text>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}"
     viewBox="0 0 ${WIDTH} ${height}" role="img"
     aria-label="${escXml(title)}">
  <title>${escXml(title)}</title>
  <!-- card background -->
  <rect width="${WIDTH}" height="${height}" rx="10" fill="${theme.bg}"
        stroke="${theme.border}" stroke-width="1"/>
  <!-- title -->
  <text x="${PADDING}" y="28" font-size="14" font-weight="600"
        fill="${theme.text}"
        font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    ${escXml(title)}
  </text>
  <!-- separator -->
  <line x1="${PADDING}" y1="40" x2="${WIDTH - PADDING}" y2="40"
        stroke="${theme.border}" stroke-width="1"/>
  ${rows}
</svg>`;
}

/**
 * SVG card showing an error message.
 */
function errorSvg(message, theme = darkTheme) {
  const WIDTH = 380;
  const HEIGHT = 80;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}"
     viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Error">
  <rect width="${WIDTH}" height="${HEIGHT}" rx="10" fill="${theme.bg}"
        stroke="${theme.border}" stroke-width="1"/>
  <text x="20" y="46" font-size="13" fill="#f85149"
        font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    ⚠ ${escXml(message)}
  </text>
</svg>`;
}

// ─── Themes ───────────────────────────────────────────────────────────────────

const darkTheme = {
  bg:      "#161b22",
  border:  "#30363d",
  text:    "#e6edf3",
  subtext: "#8b949e",
};

const lightTheme = {
  bg:      "#ffffff",
  border:  "#d0d7de",
  text:    "#1f2328",
  subtext: "#57606a",
};

function escXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

module.exports = { renderSvg, errorSvg, darkTheme, lightTheme };
