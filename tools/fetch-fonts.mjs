#!/usr/bin/env node
/**
 * Pobiera pliki woff2 (podzbiory latin i latin-ext) krojów z Google Fonts do
 * theme/assets/fonts/ i generuje theme/assets/css/fonts.css z deklaracjami @font-face.
 *
 * Pisma trzymamy w repozytorium jako pliki statyczne zamiast linkować Google
 * Fonts: bez zapytania do zewnętrznego serwera (RODO, wydajność), bez migania
 * kroju zastępczego zależnego od cudzego CDN.
 *
 * Kroje i zakres wag bierze z docs/figma/tokens.json (pole `family` i `weight`
 * stylów typografii); można je też podać wprost:
 *
 *   npm run fonts                       # kroje z tokens.json
 *   npm run fonts -- "Inter" "Lora"     # wskazane kroje, wagi z tokens.json albo 400–700
 *
 * Wymaga nagłówka User-Agent nowoczesnej przeglądarki — bez niego Google Fonts
 * zwraca format woff zamiast woff2. Podzbiór latin-ext jest obowiązkowy: bez
 * niego polskie znaki diakrytyczne renderują się w kroju zastępczym.
 *
 * Kroju spoza Google Fonts (komercyjnego) skrypt nie pobierze — pliki trzeba
 * dostać od klienta i dopisać @font-face do fonts.css ręcznie.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve as resolvePath, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const TOKENS = resolvePath(ROOT, 'docs/figma/tokens.json');
const OUT_DIR = resolvePath(ROOT, 'theme/assets/fonts');
const CSS_OUT = resolvePath(ROOT, 'theme/assets/css/fonts.css');
const SUBSETS = ['latin', 'latin-ext'];
const GENERATED_MARK = 'PLIK GENEROWANY';

const MODERN_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

export function slugifyFamily(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Kroje z tokens.json z listą użytych wag: Map { family -> [wagi rosnąco] }.
 */
export function familiesFromTokens(tokens) {
  const families = new Map();
  for (const style of tokens?.typography ?? []) {
    if (!style.family) {
      continue;
    }
    if (!families.has(style.family)) {
      families.set(style.family, new Set());
    }
    if (Number.isFinite(style.weight)) {
      families.get(style.family).add(style.weight);
    }
  }
  return new Map([...families].map(([family, weights]) => [family, [...weights].sort((a, b) => a - b)]));
}

/**
 * Oś wag w zapytaniu css2. Najpierw zakres (`400..700`) — dla krojów zmiennych
 * daje jeden plik na podzbiór zamiast osobnego na każdą wagę. Krój statyczny
 * odrzuca zakres, więc drugą próbą jest lista (`400;700`).
 */
export function weightQueries(weights) {
  const list = weights.length ? weights : [400, 700];
  const min = list[0];
  const max = list[list.length - 1];
  const range = min === max ? `${min}` : `${min}..${max}`;
  const enumerated = list.join(';');
  return range === enumerated ? [range] : [range, enumerated];
}

export function fontCssUrl(family, weightQuery) {
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weightQuery}&display=swap`;
}

/**
 * Parsuje odpowiedź CSS z Google Fonts na listę bloków @font-face, każdy
 * z nazwą podzbioru (z poprzedzającego komentarza), wagą, adresem woff2
 * i wartością unicode-range.
 */
export function parseFontFaceBlocks(css) {
  const blocks = [];
  const blockRe = /\/\*\s*([a-z0-9-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g;
  let match;
  while ((match = blockRe.exec(css))) {
    const [, subset, body] = match;
    const urlMatch = body.match(/url\((https:\/\/[^)]+\.woff2)\)/);
    if (!urlMatch) {
      continue;
    }
    const rangeMatch = body.match(/unicode-range:\s*([^;]+);/);
    const weightMatch = body.match(/font-weight:\s*([^;]+);/);
    const styleMatch = body.match(/font-style:\s*([^;]+);/);
    blocks.push({
      subset,
      url: urlMatch[1],
      unicodeRange: rangeMatch ? rangeMatch[1].trim() : null,
      weight: weightMatch ? weightMatch[1].trim() : '400',
      style: styleMatch ? styleMatch[1].trim() : 'normal',
    });
  }
  return blocks;
}

/**
 * Nazwa pliku woff2. Krój zmienny (waga jako zakres „400 700”) ma jeden plik
 * na podzbiór, statyczny — osobny na każdą wagę.
 */
export function fontFileName(familySlug, block) {
  const variable = /\s/.test(block.weight);
  return variable
    ? `${familySlug}-${block.subset}.woff2`
    : `${familySlug}-${block.weight}-${block.subset}.woff2`;
}

export function buildFontsCss(faces) {
  const header = [
    '/*',
    ` * ${GENERATED_MARK} przez tools/fetch-fonts.mjs (npm run fonts).`,
    ' * Pisma spoza Google Fonts dopisz ręcznie i usuń tę linię nagłówka —',
    ' * wtedy skrypt przestanie nadpisywać plik.',
    ' */',
    '',
  ];
  const rules = faces.map((face) =>
    [
      '@font-face {',
      `\tfont-family: '${face.family}';`,
      `\tfont-style: ${face.style};`,
      `\tfont-weight: ${face.weight};`,
      '\tfont-display: swap;',
      `\tsrc: url('../fonts/${face.file}') format('woff2');`,
      face.unicodeRange ? `\tunicode-range: ${face.unicodeRange};` : null,
      '}',
    ]
      .filter(Boolean)
      .join('\n')
  );
  return `${header.join('\n')}${rules.join('\n\n')}\n`;
}

/** fonts.css napisany ręcznie (bez znacznika) nie może zostać nadpisany. */
export function canOverwriteFontsCss(existing) {
  return existing == null || existing.includes(GENERATED_MARK);
}

async function fetchFontCss(family, weights) {
  let lastStatus = null;
  for (const query of weightQueries(weights)) {
    const response = await fetch(fontCssUrl(family, query), { headers: { 'User-Agent': MODERN_UA } });
    if (response.ok) {
      return response.text();
    }
    lastStatus = response.status;
  }
  throw new Error(
    `Google Fonts nie zwróciło kroju "${family}" (HTTP ${lastStatus}). Jeśli to krój komercyjny, ` +
      'pliki woff2 trzeba dostać od klienta i dopisać @font-face do theme/assets/css/fonts.css ręcznie.'
  );
}

function readTokens() {
  return existsSync(TOKENS) ? JSON.parse(readFileSync(TOKENS, 'utf8')) : { typography: [] };
}

async function main() {
  const args = process.argv.slice(2);
  const fromTokens = familiesFromTokens(readTokens());
  const families = args.length ? new Map(args.map((family) => [family, fromTokens.get(family) ?? []])) : fromTokens;

  if (families.size === 0) {
    throw new Error('Brak krojów: tokens.json nie ma stylów typografii, a nie podano krojów w argumentach.');
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const faces = [];

  for (const [family, weights] of families) {
    const css = await fetchFontCss(family, weights);
    const blocks = parseFontFaceBlocks(css).filter((b) => SUBSETS.includes(b.subset) && b.style === 'normal');

    for (const subset of SUBSETS) {
      if (!blocks.some((b) => b.subset === subset)) {
        throw new Error(`Google Fonts nie ma podzbioru "${subset}" dla "${family}" — polskie znaki nie zadziałają.`);
      }
    }

    const familySlug = slugifyFamily(family);
    for (const block of blocks) {
      const response = await fetch(block.url, { headers: { 'User-Agent': MODERN_UA } });
      if (!response.ok) {
        throw new Error(`Pobranie pliku woff2 nie powiodło się dla "${family}" / ${block.subset}: HTTP ${response.status}.`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const file = fontFileName(familySlug, block);
      writeFileSync(resolvePath(OUT_DIR, file), buffer);
      faces.push({ family, file, weight: block.weight, style: block.style, unicodeRange: block.unicodeRange });
      console.log(`${relative(ROOT, resolvePath(OUT_DIR, file))} (${Math.round(buffer.length / 1024)} kB, waga ${block.weight}, ${block.subset})`);
    }
  }

  const css = buildFontsCss(faces);
  const existing = existsSync(CSS_OUT) ? readFileSync(CSS_OUT, 'utf8') : null;
  if (canOverwriteFontsCss(existing)) {
    mkdirSync(dirname(CSS_OUT), { recursive: true });
    writeFileSync(CSS_OUT, css, 'utf8');
    console.log(`Zapisano ${relative(ROOT, CSS_OUT)} (${faces.length} deklaracji @font-face).`);
  } else {
    console.log(`${relative(ROOT, CSS_OUT)} był edytowany ręcznie — nie nadpisuję. Deklaracje do wklejenia:\n`);
    console.log(css);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
