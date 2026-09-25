#!/usr/bin/env node
/**
 * Składa ikony SVG z Figmy w jeden sprite <symbol> dla motywu.
 *
 * Ikony z Figmy mają kolor wpisany na sztywno (stroke="#1A2B3C"). W sprite
 * każdy kolor zamieniamy na currentColor — ikonę barwi wtedy token koloru
 * tekstu rodzica, a jedna ikona służy w każdym kolorze makiety.
 *
 * Użycie:
 *   npm run icons [-- --src design-assets/raw/icons --out theme/assets/img/icons.svg]
 * W PHP: <svg aria-hidden="true"><use href=".../icons.svg#icon-phone"/></svg>
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { basename, dirname, resolve as resolvePath, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT } from './lib/projekt.mjs';

/** Zamienia jeden plik SVG na <symbol>, z kolorami przepiętymi na currentColor. */
export function svgToSymbol(svg, id) {
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1];
  if (!viewBox) {
    throw new Error(`Ikona "${id}" nie ma atrybutu viewBox.`);
  }
  const inner = svg
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/(stroke|fill)="(?!none)[^"]+"/g, '$1="currentColor"')
    .trim();
  // fill z <svg> (zwykle "none" w ikonach liniowych) musi przejść na <symbol>,
  // inaczej ścieżki odziedziczą fill: currentColor z .fwp-icon.
  const rootFill = svg.match(/<svg[^>]*\sfill="([^"]+)"/)?.[1];
  const fillAttr = rootFill ? ` fill="${rootFill === 'none' ? 'none' : 'currentColor'}"` : '';
  return `<symbol id="icon-${id}" viewBox="${viewBox}"${fillAttr}>${inner}</symbol>`;
}

export function buildSprite(entries) {
  const symbols = entries
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(({ id, svg }) => `  ${svgToSymbol(svg, id)}`);
  return [
    '<!-- PLIK GENEROWANY (npm run icons) z design-assets/raw/icons/*.svg — nie edytuj ręcznie. -->',
    '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">',
    // Figma zmniejsza instancje ikon bez skalowania obrysu; vector-effect się nie
    // dziedziczy przez <use>, ale zmienna CSS tak. Sekcja włącza to przez
    // --fwp-icon-vector-effect: non-scaling-stroke na ikonie.
    '  <style>path,circle,ellipse,line,polyline,polygon,rect{vector-effect:var(--fwp-icon-vector-effect, none)}</style>',
    ...symbols,
    '</svg>',
    '',
  ].join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const arg = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
  const src = resolvePath(ROOT, arg('--src', 'design-assets/raw/icons'));
  const out = resolvePath(ROOT, arg('--out', 'theme/assets/img/icons.svg'));
  const entries = readdirSync(src)
    .filter((f) => f.endsWith('.svg'))
    .map((f) => ({ id: basename(f, '.svg'), svg: readFileSync(resolvePath(src, f), 'utf8') }));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buildSprite(entries), 'utf8');
  console.log(`Zapisano ${relative(ROOT, out)} (${entries.length} ikon).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
