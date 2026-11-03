/**
 * Felix Checkers - version and change log.
 * Bump `current` and add an entry to the top of `log` on every release.
 * index.html uses the same number in its ?v= script/style links, so a new
 * release loads fresh files rather than old cached ones.
 */
const FELIX_VERSION = {
  current: '1.2.1',
  log: [
    {
      version: '1.2.1',
      date: '2026-11-03',
      changes: [
        'Version log added to the bottom of Game Options.',
        'Script and style links are versioned so updates load fresh.'
      ]
    },
    {
      version: '1.2.0',
      date: '2026-11-03',
      changes: [
        'Maintenance switch (Game Options): the bold board frame shows each side’s chance of winning. Off by default.'
      ]
    },
    {
      version: '1.1.1',
      date: '2026-11-02',
      changes: [
        'Queens and bishops can always make normal moves. Compulsory capture applies to checkers only.'
      ]
    },
    {
      version: '1.1.0',
      date: '2026-11-02',
      changes: [
        '1 Player / 2 Players setting, with computer levels 1 to 5.',
        'Compulsory capture for checkers.',
        'Wins saved in a cookie and shown on the scoreboard.'
      ]
    },
    {
      version: '1.0.0',
      date: '2026-11-02',
      changes: ['First version: standard and Felix checkers.']
    }
  ]
};
