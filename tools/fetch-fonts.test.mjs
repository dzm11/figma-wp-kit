import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  familiesFromTokens,
  weightQueries,
  fontCssUrl,
  parseFontFaceBlocks,
  fontFileName,
  buildFontsCss,
  canOverwriteFontsCss,
  slugifyFamily,
} from './fetch-fonts.mjs';

test('familiesFromTokens zbiera kroje i ich wagi rosnąco, bez powtórzeń', () => {
  const families = familiesFromTokens({
    typography: [
      { family: 'Inter', weight: 700 },
      { family: 'Inter', weight: 400 },
      { family: 'Inter', weight: 400 },
      { family: 'Instrument Sans', weight: 600 },
    ],
  });
  assert.deepEqual([...families], [
    ['Inter', [400, 700]],
    ['Instrument Sans', [600]],
  ]);
});

test('familiesFromTokens radzi sobie z pustym plikiem', () => {
  assert.equal(familiesFromTokens({}).size, 0);
});

test('weightQueries: najpierw zakres dla kroju zmiennego, potem lista dla statycznego', () => {
  assert.deepEqual(weightQueries([400, 500, 700]), ['400..700', '400;500;700']);
  assert.deepEqual(weightQueries([600]), ['600']);
  assert.deepEqual(weightQueries([]), ['400..700', '400;700']);
});

test('fontCssUrl koduje nazwę kroju ze spacją', () => {
  assert.equal(
    fontCssUrl('Instrument Sans', '400..700'),
    'https://fonts.googleapis.com/css2?family=Instrument%20Sans:wght@400..700&display=swap'
  );
});

const googleCss = `
/* latin-ext */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/inter/v1/ext.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+02BD-02C5;
}
/* latin */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/inter/v1/latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131;
}
/* cyrillic */
@font-face {
  font-family: 'Inter';
  src: url(https://fonts.gstatic.com/s/inter/v1/cyr.woff) format('woff');
}
`;

test('parseFontFaceBlocks wyciąga podzbiór, wagę, adres woff2 i unicode-range', () => {
  const blocks = parseFontFaceBlocks(googleCss);
  assert.equal(blocks.length, 2, 'blok bez woff2 jest pomijany');
  assert.deepEqual(blocks[0], {
    subset: 'latin-ext',
    url: 'https://fonts.gstatic.com/s/inter/v1/ext.woff2',
    unicodeRange: 'U+0100-02BA, U+02BD-02C5',
    weight: '400 700',
    style: 'normal',
  });
  assert.equal(blocks[1].subset, 'latin');
});

test('fontFileName: krój zmienny ma plik na podzbiór, statyczny na wagę i podzbiór', () => {
  assert.equal(fontFileName('inter', { subset: 'latin', weight: '400 700' }), 'inter-latin.woff2');
  assert.equal(fontFileName('lora', { subset: 'latin-ext', weight: '600' }), 'lora-600-latin-ext.woff2');
});

test('slugifyFamily daje nazwę pliku', () => {
  assert.equal(slugifyFamily('Instrument Sans'), 'instrument-sans');
});

test('buildFontsCss generuje @font-face ze ścieżką względem css/ i znacznikiem generowania', () => {
  const css = buildFontsCss([
    { family: 'Inter', file: 'inter-latin.woff2', weight: '400 700', style: 'normal', unicodeRange: 'U+0000-00FF' },
  ]);
  assert.match(css, /PLIK GENEROWANY/);
  assert.match(css, /font-family: 'Inter';/);
  assert.match(css, /font-weight: 400 700;/);
  assert.match(css, /font-display: swap;/);
  assert.match(css, /src: url\('\.\.\/fonts\/inter-latin\.woff2'\) format\('woff2'\);/);
  assert.match(css, /unicode-range: U\+0000-00FF;/);
});

test('canOverwriteFontsCss chroni plik edytowany ręcznie', () => {
  assert.equal(canOverwriteFontsCss(null), true);
  assert.equal(canOverwriteFontsCss(buildFontsCss([])), true);
  assert.equal(canOverwriteFontsCss("@font-face { font-family: 'Komercyjny'; }"), false);
});
