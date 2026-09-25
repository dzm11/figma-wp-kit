import { test } from 'node:test';
import assert from 'node:assert/strict';
import { svgToSymbol, buildSprite } from './icons-sprite.mjs';

const phone =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">\n' +
  '<path d="M1 1" stroke="#1A2B3C" stroke-width="2"/>\n<path d="M2 2" fill="#0A0B0C"/>\n</svg>\n';

test('svgToSymbol przepina kolory na currentColor i zostawia fill="none"', () => {
  const symbol = svgToSymbol(phone, 'phone');
  assert.match(symbol, /^<symbol id="icon-phone" viewBox="0 0 24 24"( fill="none")?>/);
  assert.match(symbol, /stroke="currentColor" stroke-width="2"/);
  assert.match(symbol, /fill="currentColor"/);
  assert.doesNotMatch(symbol, /#1A2B3C|#0A0B0C|<svg/);
});

test('svgToSymbol odrzuca ikonę bez viewBox', () => {
  assert.throws(() => svgToSymbol('<svg><path/></svg>', 'x'), /viewBox/);
});

test('buildSprite sortuje symbole i ukrywa sprite', () => {
  const sprite = buildSprite([
    { id: 'plus', svg: phone },
    { id: 'minus', svg: phone },
  ]);
  assert.match(sprite, /style="display:none"/);
  assert.ok(sprite.indexOf('icon-minus') < sprite.indexOf('icon-plus'));
});

// Ikony liniowe mają fill="none" na <svg>, a ścieżki tylko stroke. Bez
// przeniesienia fill na <symbol> ścieżki dziedziczą fill: currentColor
// z .fwp-icon i ikona zalewa się kolorem.
test('svgToSymbol przenosi fill z elementu svg na symbol', () => {
  assert.match(svgToSymbol(phone, 'phone'), /^<symbol id="icon-phone" viewBox="0 0 24 24" fill="none">/);
});

// Figma zmniejsza instancje ikon bez skalowania obrysu (16 px nadal 1,75).
// vector-effect nie dziedziczy się przez <use>, ale zmienna CSS tak — sprite
// ma regułę sterowaną zmienną, a sekcja włącza ją tam, gdzie tak jest w Figmie.
test('buildSprite pozwala włączyć nieskalowany obrys zmienną CSS', () => {
  const sprite = buildSprite([{ id: 'phone', svg: phone }]);
  assert.match(sprite, /<style>[^<]*vector-effect:\s*var\(--fwp-icon-vector-effect,\s*none\)/);
});
