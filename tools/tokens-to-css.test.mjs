import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  slugify,
  pxToRem,
  typographyToken,
  buildCss,
  validateTokens,
  lineHeightWarnings,
  snapLineHeight,
} from './tokens-to-css.mjs';

test('slugify zamienia ukośniki i spacje na myślniki', () => {
  assert.equal(slugify('Blue/600'), 'blue-600');
  assert.equal(slugify('Base/White'), 'base-white');
  assert.equal(slugify('bg/brand-subtle'), 'bg-brand-subtle');
  assert.equal(slugify('Text sm / Bold'), 'text-sm-bold');
});

test('pxToRem dzieli przez podstawę i obcina zbędne zera', () => {
  assert.equal(pxToRem(48), '3rem');
  assert.equal(pxToRem(18), '1.125rem');
  assert.equal(pxToRem(0), '0');
});

test('typographyToken odcina wagę po ostatnim ukośniku', () => {
  assert.equal(typographyToken('Heading 2xl/Semibold'), 'heading-2xl');
  assert.equal(typographyToken('Overline/Medium'), 'overline');
  assert.equal(typographyToken('Body'), 'body');
});

const fixture = {
  meta: { fileKey: 'ABC', generatedAt: '2026-09-20T00:00:00.000Z', page: 'Strona' },
  primitives: [
    { name: 'Lime/300', hex: '#d4f34a' },
    { name: 'Base/White', hex: '#ffffff' },
  ],
  semantic: [
    { name: 'bg/brand', alias: 'Lime/300', hex: '#d4f34a' },
    { name: 'text/primary', alias: null, hex: '#0a0a0a' },
  ],
  typography: [
    { name: 'Heading 2xl/Semibold', family: 'Instrument Sans', weight: 600,
      size: 48, lineHeight: 1.15, letterSpacing: -0.02 },
  ],
  layout: { container: 1480, gutter: 50, wrapper: 1820, space: [10, 124] },
};

test('buildCss ostrzega, że plik jest generowany', () => {
  assert.match(buildCss(fixture), /GENEROWANY/);
  assert.match(buildCss(fixture), /tools\/tokens-to-css\.mjs/);
});

test('buildCss w nagłówku odróżnia dane z Figmy od szablonu', () => {
  assert.match(buildCss(fixture), /2026-09-20T00:00:00\.000Z/);
  const template = { ...fixture, meta: { fileKey: '', generatedAt: '', page: '' } };
  assert.match(buildCss(template), /szablonu/);
});

test('buildCss emituje prymitywy przed semantycznymi', () => {
  const css = buildCss(fixture);
  assert.ok(css.indexOf('--fwp-lime-300') < css.indexOf('--fwp-bg-brand'),
    'prymitywy muszą być zadeklarowane wcześniej, inaczej alias nie ma do czego się odwołać');
});

test('buildCss zachowuje alias jako var(), nie jako skopiowany hex', () => {
  const css = buildCss(fixture);
  assert.match(css, /--fwp-bg-brand:\s*var\(--fwp-lime-300\);/);
  assert.match(css, /--fwp-text-primary:\s*#0a0a0a;/);
});

test('buildCss rozkłada styl tekstowy na rozmiar, interlinię, rozstrzelenie i krój', () => {
  const css = buildCss(fixture);
  assert.match(css, /--fwp-t-heading-2xl-size:\s*3rem;/);
  assert.match(css, /--fwp-t-heading-2xl-lh:\s*1\.15;/);
  assert.match(css, /--fwp-t-heading-2xl-ls:\s*-0\.02em;/);
  assert.match(css, /--fwp-t-heading-2xl-family:\s*var\(--fwp-font-family-instrument-sans\);/);
});

test('buildCss emituje token kroju z zapasowym krojem generycznym', () => {
  const css = buildCss(fixture);
  assert.match(css, /--fwp-font-family-instrument-sans:\s*'Instrument Sans', sans-serif;/);
  const serif = {
    ...fixture,
    typography: [{ ...fixture.typography[0], family: 'Lora', fallback: 'serif' }],
  };
  assert.match(buildCss(serif), /--fwp-font-family-lora:\s*'Lora', serif;/);
});

test('buildCss emituje odstępy w rem, a wymiary layoutu w px', () => {
  const css = buildCss(fixture);
  assert.match(css, /--fwp-space-124:\s*7\.75rem;/);
  assert.match(css, /--fwp-container:\s*1480px;/);
  assert.match(css, /--fwp-gutter:\s*50px;/);
  assert.match(css, /--fwp-wrapper:\s*1820px;/);
});

test('buildCss odrzuca alias wskazujący na nieistniejący prymityw', () => {
  const broken = { ...fixture, semantic: [{ name: 'bg/x', alias: 'Nie/Ma', hex: '#000000' }] };
  assert.throws(() => buildCss(broken), /Nie\/Ma/);
});

test('buildCss emituje role krojów jako aliasy tokenów kroju', () => {
  const withRoles = { ...fixture, fonts: { heading: 'Instrument Sans' } };
  assert.match(buildCss(withRoles), /--fwp-font-family-heading:\s*var\(--fwp-font-family-instrument-sans\);/);
});

test('validateTokens odrzuca rolę wskazującą krój, którego nie ma w typografii', () => {
  const broken = { ...fixture, fonts: { body: 'Comic Sans' } };
  assert.match(validateTokens(broken).join(' '), /fonts\.body.*Comic Sans/);
});

// Warianty wagowe jednego stylu dzielą geometrię.

const fourWeightVariants = {
  ...fixture,
  typography: [
    ...fixture.typography,
    { name: 'Text sm/Regular', family: 'Inter', weight: 400, size: 14, lineHeight: 1.428571, letterSpacing: 0 },
    { name: 'Text sm/Medium', family: 'Inter', weight: 500, size: 14, lineHeight: 1.428571, letterSpacing: 0 },
    { name: 'Text sm/Semibold', family: 'Inter', weight: 600, size: 14, lineHeight: 1.428571, letterSpacing: 0 },
    { name: 'Text sm/Bold', family: 'Inter', weight: 700, size: 14, lineHeight: 1.428571, letterSpacing: 0 },
  ],
};

test('styl z kilkoma wariantami wagowymi emituje geometrię raz i bez tokenu wagi', () => {
  const css = buildCss(fourWeightVariants);
  assert.equal((css.match(/--fwp-t-text-sm-size:/g) || []).length, 1,
    'tokeny geometrii nie mogą się duplikować per wariant wagowy');
  assert.match(css, /--fwp-t-text-sm-size:\s*0\.875rem;/);
  assert.match(css, /--fwp-t-text-sm-lh:\s*1\.428571429;/);
  assert.match(css, /--fwp-t-text-sm-ls:\s*0em;/);
  assert.doesNotMatch(css, /--fwp-t-text-sm-weight/);
});

test('buildCss emituje współdzielone tokeny wag', () => {
  const css = buildCss(fourWeightVariants);
  assert.match(css, /--fwp-font-regular:\s*400;/);
  assert.match(css, /--fwp-font-medium:\s*500;/);
  assert.match(css, /--fwp-font-semibold:\s*600;/);
  assert.match(css, /--fwp-font-bold:\s*700;/);
});

test('buildCss nazywa także wagi spoza zakresu 400–700', () => {
  const light = { ...fixture, typography: [{ ...fixture.typography[0], weight: 300 }] };
  assert.match(buildCss(light), /--fwp-font-light:\s*300;/);
});

test('styl z jednym wariantem zachowuje własny token wagi', () => {
  const css = buildCss(fixture);
  assert.match(css, /--fwp-t-heading-2xl-weight:\s*600;/);
});

test('buildCss rzuca wyjątkiem, gdy warianty wagowe jednego stylu różnią się geometrią', () => {
  const mismatched = {
    ...fixture,
    typography: [
      ...fixture.typography,
      { name: 'Text sm/Regular', family: 'Inter', weight: 400, size: 14, lineHeight: 1.428571, letterSpacing: 0 },
      { name: 'Text sm/Bold', family: 'Inter', weight: 700, size: 16, lineHeight: 1.428571, letterSpacing: 0 },
    ],
  };
  assert.throws(() => buildCss(mismatched), /Text sm/);
  assert.throws(() => buildCss(mismatched), /size/);
});

test('nazwa ze spacjami wokół ukośnika parsuje się tak samo jak bez spacji', () => {
  const spaced = {
    ...fixture,
    typography: [
      ...fixture.typography,
      { name: 'Text sm/Regular', family: 'Inter', weight: 400, size: 14, lineHeight: 1.428571, letterSpacing: 0 },
      { name: 'Text sm / Bold', family: 'Inter', weight: 700, size: 14, lineHeight: 1.428571, letterSpacing: 0 },
    ],
  };
  const css = buildCss(spaced);
  assert.match(css, /--fwp-t-text-sm-size:\s*0\.875rem;/);
  assert.match(css, /--fwp-font-bold:\s*700;/);
});

// Walidacja schematu — błąd ma wskazać zły wpis.

test('validateTokens przepuszcza poprawny plik', () => {
  assert.deepEqual(validateTokens(fixture), []);
});

test('validateTokens wskazuje brakujące sekcje i złe wpisy', () => {
  assert.match(validateTokens({}).join(' '), /primitives/);
  const broken = {
    ...fixture,
    primitives: [{ name: 'X', hex: 'czerwony' }],
    typography: [{ name: 'H1', family: 'Inter', weight: 600, size: '48px', lineHeight: 1.2, letterSpacing: 0 }],
    layout: { ...fixture.layout, gutter: null },
  };
  const problems = validateTokens(broken).join(' ');
  assert.match(problems, /primitives\[0\] "X"/);
  assert.match(problems, /typography\[0\] "H1": "size"/);
  assert.match(problems, /layout\.gutter/);
  assert.throws(() => buildCss(broken), /tokens\.json ma błędy/);
});

// Interlinia: rozmiar × mnożnik powinien domykać się do pełnego piksela.

test('lineHeightWarnings milczy, gdy interlinia domyka się do piksela albo generator ją domknie', () => {
  assert.deepEqual(lineHeightWarnings([{ name: 'A', size: 48, lineHeight: 1.25 }]), []);
  assert.deepEqual(lineHeightWarnings([{ name: 'B', size: 14, lineHeight: 1.428571 }]), []);
  // 14 × 1.429 = 20.006 px: poniżej progu 0,01 px, poprawia snapLineHeight.
  assert.deepEqual(lineHeightWarnings([{ name: 'C', size: 14, lineHeight: 1.429 }]), []);
});

test('lineHeightWarnings wskazuje ułamkowy wiersz powyżej progu i podpowiada mnożnik', () => {
  const [warning] = lineHeightWarnings([{ name: 'Display/Regular', size: 72, lineHeight: 1.1 }]);
  assert.match(warning, /Display\/Regular/);
  assert.match(warning, /79\.2px/);
  assert.match(warning, /79px/);
});

// Przeglądarka liczy wiersz w LayoutUnit (1/64 px) i zaokrągla w dół:
// 24 × 1.208333 = 28.999992 daje wiersz 28.984 px zamiast 29. Generator
// domyka mnożnik w górę do 9 miejsc, żeby iloczyn nie spadł poniżej piksela.

test('snapLineHeight domyka mnożnik w górę, gdy iloczyn jest tuż pod pełnym pikselem', () => {
  const lh = snapLineHeight(24, 1.208333);
  assert.equal(lh, 1.208333334);
  assert.ok(24 * lh >= 29, `24 × ${lh} = ${24 * lh} < 29`);
  assert.equal(snapLineHeight(14, 1.428571), 1.428571429);
  assert.ok(14 * snapLineHeight(14, 1.428571) >= 20);
  assert.equal(snapLineHeight(14, 1.429), 1.428571429);
});

test('snapLineHeight zostawia mnożnik dokładny i zamierzony ułamkowy wiersz', () => {
  assert.equal(snapLineHeight(48, 1.25), 1.25);
  assert.equal(snapLineHeight(16, 1.5), 1.5);
  // 72 × 1.1 = 79.2 px — różnica 0,2 px to nie zaokrąglenie, tylko projekt.
  assert.equal(snapLineHeight(72, 1.1), 1.1);
  // Iloczyn tuż NAD pikselem dostaje czysty mnożnik bez fałszywej jedynki.
  assert.equal(snapLineHeight(48, 1.2500001), 1.25);
});

test('buildCss wypisuje domkniętą interlinię w tokenach', () => {
  const css = buildCss({
    ...fixture,
    typography: [{ name: 'Heading md/Semibold', family: 'Inter', weight: 600, size: 24, lineHeight: 1.208333, letterSpacing: 0 }],
  });
  assert.match(css, /--fwp-t-heading-md-lh:\s*1\.208333334;/);
});

// Plik w repozytorium (szablon albo dane z Figmy) musi dawać się wygenerować —
// inaczej projekt startuje od błędu. Ostrzeżeń interlinii tu nie sprawdzamy:
// styl z interlinią w procentach (72px × 110% = 79.2px) daje w Figmie
// ułamkowy wiersz naprawdę, więc ostrzeżenie dla prawdziwych danych jest
// informacją, nie błędem.

test('docs/figma/tokens.json przechodzi walidację i generuje CSS', () => {
  const template = JSON.parse(readFileSync(new URL('../docs/figma/tokens.json', import.meta.url), 'utf8'));
  assert.deepEqual(validateTokens(template), []);
  assert.match(buildCss(template), /:root \{/);
});

// Promienie i cienie: opcjonalne sekcje. Bez nich sekcje wpisywałyby
// wartości z makiety na sztywno, a zmiana cienia karty oznaczałaby
// przeszukiwanie wszystkich arkuszy.

const withEffects = {
  ...fixture,
  radius: [
    { name: 'radius/sm', value: 8 },
    { name: 'radius/full', value: 999 },
  ],
  shadow: [
    { name: 'card', value: '0 2px 4px 0 rgba(0, 0, 0, 0.05), 0 10px 24px -6px rgba(0, 0, 0, 0.12)' },
  ],
};

test('buildCss emituje promienie w px pod nazwą ze zmiennej Figmy', () => {
  const css = buildCss(withEffects);
  assert.match(css, /--fwp-radius-sm: 8px;/);
  assert.match(css, /--fwp-radius-full: 999px;/);
});

test('buildCss emituje cienie, także warstwowe, bez zmian w wartości', () => {
  const css = buildCss(withEffects);
  assert.match(
    css,
    /--fwp-shadow-card: 0 2px 4px 0 rgba\(0, 0, 0, 0\.05\), 0 10px 24px -6px rgba\(0, 0, 0, 0\.12\);/
  );
});

test('buildCss bez sekcji radius i shadow nie emituje ich bloków', () => {
  const css = buildCss(fixture);
  assert.doesNotMatch(css, /--fwp-radius-/);
  assert.doesNotMatch(css, /--fwp-shadow-/);
});

test('validateTokens wskazuje zły promień i pusty cień', () => {
  const broken = {
    ...fixture,
    radius: [{ name: 'radius/md', value: '12px' }],
    shadow: [{ name: 'card', value: '' }],
  };
  const problems = validateTokens(broken).join(' ');
  assert.match(problems, /radius\[0\] "radius\/md": "value"/);
  assert.match(problems, /shadow\[0\] "card": "value"/);
});

// Zmienna semantyczna o tej samej nazwie co prymityw, na który wskazuje,
// dałaby w CSS cykl `--fwp-x: var(--fwp-x)` — kolor po cichu znika.

test('validateTokens odrzuca token semantyczny o nazwie prymitywu', () => {
  const clash = {
    ...fixture,
    primitives: [...fixture.primitives, { name: 'brand/social', hex: '#25d366' }],
    semantic: [...fixture.semantic, { name: 'brand/social', alias: 'brand/social', hex: '#25d366' }],
  };
  assert.match(validateTokens(clash).join(' '), /semantic\[2\] "brand\/social".*prymityw/);
});
