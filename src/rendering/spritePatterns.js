const rows = (value) => Object.freeze(value.split('/').map((row) => Object.freeze(
  [...row.replaceAll(' ', '.')].slice(0, 8).concat(Array(Math.max(0, 8 - row.length)).fill('.')),
)));

export const SPRITE_PATTERNS = Object.freeze({
  player: Object.freeze([
    rows('...LL.../..LBBL../.LBBBBL./LBBBBBBL/LBBBBBBL/LBBCCBL./.LBBBBL../..L..L...'),
    rows('...LL.../..LBBL../.LBBBBL./LBBBBBBL/LBBBBBBL/LBBCBBL./..L..L.../.L....L..'),
  ]),
  enemies: Object.freeze({
    'EN-01': Object.freeze([
      rows('...DD.../..DBBD../.DBBBBD./DBBBBBBD/DBBXXBBD/.DBBBBD../..D..D../.D....D..'),
      rows('...DD.../..DBBD../.DBBBBD./DBBBBBBD/DBBXXBBD/..DBBD.../.D....D../..D..D...'),
    ]),
    'EN-02': Object.freeze([
      rows('...AA.../..ABBA../.ABBBBA./ABBBBBBA/ABBBXBBA/.ABBBBA../..A..A../.A....A..'),
      rows('...AA.../..ABBA../.ABBBBA./ABBBBBBA/ABBBXBBA/..ABBA.../.A....A../..A..A...'),
    ]),
    'EN-03': Object.freeze([
      rows('..SSSS../.SBBBB S./SBBBBBBS/SBBXXBBS/SBBBBBBS/SBBBBBBS/.SS..SS../SS....SS'),
      rows('..SSSS../.SBBBB S./SBBBBBBS/SBBXXBBS/SBBBBBBS/SBBBBBBS/SS....SS/.SS..SS..'),
    ]),
    fallback: Object.freeze([
      rows('...??.../..?BB?../.?BBBB?./?BBBBBB?/??BBBB??/.?BBBB?../..?...?.../...??...'),
    ]),
  }),
  boss: rows('...RRR.../..RBBBR../.RBBBBBR./RBBBBBBBR/RBBXXXBBR/RBBBBBBBR/.RBBBBBR../..RRRRR.../..R...R...'),
});

export const SPRITE_PALETTES = Object.freeze({
  player: Object.freeze({ L: '#a9fbff', B: '#4cf3ff', C: '#f4ffff' }),
  'EN-01': Object.freeze({ D: '#ab314f', B: '#ff5e70', X: '#ffe4ea' }),
  'EN-02': Object.freeze({ A: '#d45f2d', B: '#ff944d', X: '#fff0bd' }),
  'EN-03': Object.freeze({ S: '#637487', B: '#a9bacd', X: '#f6fbff' }),
  fallback: Object.freeze({ '?': '#9aa9b9', B: '#657487' }),
  boss: Object.freeze({ R: '#7c234a', B: '#dc426c', X: '#ffb0c0' }),
});

export function drawPixelPattern(context, pattern, palette, x, y, size) {
  if (!Array.isArray(pattern) || pattern.length === 0) return;
  const cellWidth = size / pattern[0].length;
  const cellHeight = size / pattern.length;
  pattern.forEach((row, rowIndex) => {
    row.forEach((key, columnIndex) => {
      const color = palette[key];
      if (!color || key === '.') return;
      context.fillStyle = color;
      context.fillRect(
        x + columnIndex * cellWidth,
        y + rowIndex * cellHeight,
        cellWidth,
        cellHeight,
      );
    });
  });
}
