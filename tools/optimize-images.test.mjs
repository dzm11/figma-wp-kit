import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planVariants, isRetina, parseImageArgs, DEFAULT_SRC, DEFAULT_OUT } from './optimize-images.mjs';

test('isRetina rozpoznaje sufiks gęstości', () => {
  assert.equal(isRetina('hero/hero-badge@2x.png'), true);
  assert.equal(isRetina('hero/hero-badge@1.5x.png'), true);
  assert.equal(isRetina('hero/hero-badge.png'), false);
});

test('plik JPG daje wariant WebP i kopię oryginału w tym samym katalogu', () => {
  const plan = planVariants('projects/project-photo.jpg');
  assert.deepEqual(plan, [
    { out: 'projects/project-photo.webp', format: 'webp' },
    { out: 'projects/project-photo.jpg', format: 'copy' },
  ]);
});

test('plik @2x zachowuje sufiks w nazwie wynikowej', () => {
  const plan = planVariants('projects/project-photo@2x.jpg');
  assert.ok(plan.some((v) => v.out === 'projects/project-photo@2x.webp'));
});

test('PNG zostaje PNG-iem, bo logotypy potrzebują przezroczystości', () => {
  const plan = planVariants('clients/client-logo.png');
  assert.deepEqual(plan.map((v) => v.out).sort(), ['clients/client-logo.png', 'clients/client-logo.webp']);
});

test('rozszerzenie wielkimi literami też jest rastrem', () => {
  assert.equal(planVariants('a/B.JPEG').length, 2);
});

test('SVG przechodzi bez zmian', () => {
  assert.deepEqual(planVariants('icons/arrow-right.svg'), [{ out: 'icons/arrow-right.svg', format: 'copy' }]);
});

test('pliki innych typów są pomijane', () => {
  assert.deepEqual(planVariants('README.md'), []);
  assert.deepEqual(planVariants('eksport.pdf'), []);
});

test('parseImageArgs: domyślnie surowe eksporty z figma:assets spoza motywu -> motyw', () => {
  assert.deepEqual(parseImageArgs([]), { src: DEFAULT_SRC, out: DEFAULT_OUT });
  assert.equal(DEFAULT_SRC, 'design-assets/raw');
  assert.equal(DEFAULT_OUT, 'theme/assets/img');
  assert.deepEqual(parseImageArgs(['--src', 'design-assets', '--out', 'x']), { src: 'design-assets', out: 'x' });
  assert.throws(() => parseImageArgs(['--cos']), /Nieznany argument/);
});
