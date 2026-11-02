/**
 * Felix Checkers - Win tracking stored in a browser cookie.
 *
 * Cookie shape (JSON, URL-encoded):
 *   {
 *     pvp: { red: 0, black: 0 },                 // 2-player wins
 *     ai:  { wins: {1:0..5:0}, losses: {1:0..5:0} } // wins/losses vs computer, per level
 *   }
 */
const FelixStats = (() => {
  const COOKIE_NAME = 'felix_stats';
  const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;
  const LEVELS = [1, 2, 3, 4, 5];

  function emptyLevelTable() {
    const table = {};
    LEVELS.forEach(l => { table[l] = 0; });
    return table;
  }

  function defaults() {
    return {
      pvp: { red: 0, black: 0 },
      ai: { wins: emptyLevelTable(), losses: emptyLevelTable() }
    };
  }

  const toCount = (v) => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);

  // Accepts whatever came out of the cookie and returns a well-formed stats object
  function normalize(raw) {
    const stats = defaults();
    if (!raw || typeof raw !== 'object') return stats;

    if (raw.pvp && typeof raw.pvp === 'object') {
      stats.pvp.red = toCount(raw.pvp.red);
      stats.pvp.black = toCount(raw.pvp.black);
    }
    if (raw.ai && typeof raw.ai === 'object') {
      LEVELS.forEach(l => {
        if (raw.ai.wins) stats.ai.wins[l] = toCount(raw.ai.wins[l]);
        if (raw.ai.losses) stats.ai.losses[l] = toCount(raw.ai.losses[l]);
      });
    }
    return stats;
  }

  // Pull our cookie out of a document.cookie style string
  function parseCookieString(cookieString) {
    if (!cookieString) return defaults();
    const match = cookieString.match(new RegExp('(?:^|;\\s*)' + COOKIE_NAME + '=([^;]*)'));
    if (!match) return defaults();
    try {
      return normalize(JSON.parse(decodeURIComponent(match[1])));
    } catch (e) {
      return defaults();
    }
  }

  function load(doc = (typeof document !== 'undefined' ? document : null)) {
    try {
      return parseCookieString(doc ? doc.cookie : '');
    } catch (e) {
      return defaults();
    }
  }

  function save(stats, doc = (typeof document !== 'undefined' ? document : null)) {
    try {
      if (!doc) return false;
      const value = encodeURIComponent(JSON.stringify(normalize(stats)));
      doc.cookie = `${COOKIE_NAME}=${value}; max-age=${ONE_YEAR_SECONDS}; path=/; SameSite=Lax`;
      return true;
    } catch (e) {
      return false; // cookies blocked: the game still works, scores just won't persist
    }
  }

  // Returns a new stats object with one finished game added.
  // game: { mode: 'pvp' | 'ai', winner: 'red' | 'black', level?: 1-5 }
  // For 'ai', Red is the human player and Black is the computer.
  function recordGame(stats, game) {
    const next = normalize(stats);
    if (game.mode === 'pvp') {
      if (game.winner === 'red') next.pvp.red += 1;
      else if (game.winner === 'black') next.pvp.black += 1;
    } else if (game.mode === 'ai' && LEVELS.includes(game.level)) {
      if (game.winner === 'red') next.ai.wins[game.level] += 1;
      else if (game.winner === 'black') next.ai.losses[game.level] += 1;
    }
    return next;
  }

  function totals(stats) {
    const s = normalize(stats);
    const sum = (table) => LEVELS.reduce((total, l) => total + table[l], 0);
    return {
      playerWins: sum(s.ai.wins),
      computerWins: sum(s.ai.losses)
    };
  }

  function reset() {
    return defaults();
  }

  return { LEVELS, defaults, normalize, parseCookieString, load, save, recordGame, totals, reset, COOKIE_NAME };
})();

if (typeof window !== 'undefined') {
  window.FelixStats = FelixStats;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FelixStats;
}
