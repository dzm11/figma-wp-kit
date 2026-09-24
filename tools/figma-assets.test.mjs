import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugifyName, parseAssetArgs, exportExtra, planFiles, DEFAULT_OUT } from './figma-assets.mjs';

test('slugifyName usuwa polskie znaki i zamienia resztę na myślniki', () => {
  assert.equal(slugifyName('Żółta łódź'), 'zolta-lodz');
  assert.equal(slugifyName('Logo / Główne ŚWIATŁO'), 'logo-glowne-swiatlo');
  assert.equal(slugifyName('  Icon_arrow--right  '), 'icon-arrow-right');
});

test('slugifyName nie zwraca pustej nazwy pliku', () => {
  assert.equal(slugifyName('***'), 'grafika');
});

test('parseAssetArgs: wartości domyślne', () => {
  const opts = parseAssetArgs(['470-29428']);
  assert.deepEqual(opts.ids, ['470:29428']);
  assert.equal(opts.format, 'png');
  assert.equal(opts.scale, 1);
  assert.equal(opts.out, DEFAULT_OUT);
  assert.equal(DEFAULT_OUT, 'design-assets/raw', 'surowe eksporty nie mogą lądować w motywie');
  assert.equal(opts.svgOutlineText, false);
});

test('parseAssetArgs: wiele węzłów w obu formach, opcje i nazwy', () => {
  const opts = parseAssetArgs([
    '470-29428',
    '470:29438',
    '--format',
    'SVG',
    '--scale',
    '2',
    '--out',
    'tmp/x',
    '--nazwa',
    'logo,ikona',
    '--svg-outline-text',
    'true',
  ]);
  assert.deepEqual(opts.ids, ['470:29428', '470:29438']);
  assert.equal(opts.format, 'svg');
  assert.equal(opts.scale, 2);
  assert.equal(opts.out, 'tmp/x');
  assert.deepEqual(opts.names, ['logo', 'ikona']);
  assert.equal(opts.svgOutlineText, true);
});

test('parseAssetArgs: --nazwa można powtarzać', () => {
  const opts = parseAssetArgs(['1-2', '3-4', '--nazwa', 'a', '--nazwa', 'b']);
  assert.deepEqual(opts.names, ['a', 'b']);
});

test('parseAssetArgs: jpeg to alias jpg', () => {
  assert.equal(parseAssetArgs(['1-2', '--format', 'jpeg']).format, 'jpg');
});

test('parseAssetArgs: ten sam węzeł podany dwa razy liczy się raz', () => {
  assert.deepEqual(parseAssetArgs(['1-2', '1:2']).ids, ['1:2']);
});

test('parseAssetArgs: czytelne błędy', () => {
  assert.throws(() => parseAssetArgs([]), /co najmniej jeden/);
  assert.throws(() => parseAssetArgs(['1-2', '--format', 'webp']), /webp/);
  assert.throws(() => parseAssetArgs(['1-2', '--scale', '9']), /skala/i);
  assert.throws(() => parseAssetArgs(['1-2', '--nazwa', 'a,b']), /Liczba nazw/);
  assert.throws(() => parseAssetArgs(['1-2', '--svg-outline-text', 'tak']), /true albo false/);
  assert.throws(() => parseAssetArgs(['1-2', '--cos']), /Nieznana opcja/);
  assert.throws(() => parseAssetArgs(['1-2', '--format']), /Brak wartości/);
});

test('parseAssetArgs: --help nie wymaga węzłów', () => {
  assert.equal(parseAssetArgs(['--help']).help, true);
});

test('exportExtra: SVG bez zamiany tekstu na krzywe i bez id warstw', () => {
  assert.deepEqual(exportExtra('svg'), { svg_outline_text: false, svg_include_id: false });
  assert.deepEqual(exportExtra('svg', true), { svg_outline_text: true, svg_include_id: false });
  assert.deepEqual(exportExtra('png'), {});
});

test('planFiles: nazwy z warstw, sufiks skali tylko dla rastrów', () => {
  const layers = new Map([
    ['1:2', 'Logo główne'],
    ['3:4', 'Hero photo'],
  ]);
  assert.deepEqual(planFiles(['1:2', '3:4'], layers, { format: 'png', scale: 2 }), [
    { id: '1:2', file: 'logo-glowne@2x.png' },
    { id: '3:4', file: 'hero-photo@2x.png' },
  ]);
  assert.deepEqual(planFiles(['1:2'], layers, { format: 'svg', scale: 2 }), [
    { id: '1:2', file: 'logo-glowne.svg' },
  ]);
});

test('planFiles: nazwy podane przez użytkownika mają pierwszeństwo', () => {
  const layers = new Map([['1:2', 'Frame 123']]);
  const plan = planFiles(['1:2'], layers, { format: 'jpg', names: new Map([['1:2', 'Zdjęcie zespołu']]) });
  assert.deepEqual(plan, [{ id: '1:2', file: 'zdjecie-zespolu.jpg' }]);
});

test('planFiles: kolizje nazw dostają kolejne numery', () => {
  const layers = new Map([
    ['1:2', 'Icon'],
    ['3:4', 'Icon'],
    ['5:6', 'icon'],
  ]);
  const files = planFiles(['1:2', '3:4', '5:6'], layers, { format: 'svg' }).map((p) => p.file);
  assert.deepEqual(files, ['icon.svg', 'icon-2.svg', 'icon-3.svg']);
});
