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
  assert.match(css, /--fwp-t-text-sm-lh:\s*1\.428571;/);
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

test('lineHeightWarnings milczy, gdy interlinia domyka się do piksela', () => {
  assert.deepEqual(lineHeightWarnings([{ name: 'A', size: 48, lineHeight: 1.25 }]), []);
  assert.deepEqual(lineHeightWarnings([{ name: 'B', size: 14, lineHeight: 1.428571 }]), []);
});

test('lineHeightWarnings wskazuje zbyt mocno zaokrąglony mnożnik i podpowiada lepszy', () => {
  const [warning] = lineHeightWarnings([{ name: 'Text sm/Regular', size: 14, lineHeight: 1.429 }]);
  assert.match(warning, /Text sm\/Regular/);
  assert.match(warning, /20px/);
  assert.match(warning, /1\.428571/);
});

// Szablon w repozytorium musi dawać się wygenerować — inaczej świeży projekt
// startuje od błędu.

test('szablon docs/figma/tokens.json przechodzi walidację i generuje CSS', () => {
  const template = JSON.parse(readFileSync(new URL('../docs/figma/tokens.json', import.meta.url), 'utf8'));
  assert.deepEqual(validateTokens(template), []);
  assert.match(buildCss(template), /:root \{/);
  assert.deepEqual(lineHeightWarnings(template.typography), []);
});
