#!/usr/bin/env node
/**
 * Zamienia docs/figma/tokens.json na theme/assets/css/tokens.css.
 *
 * tokens.json wypełnia agent przez MCP figma-console (zmienne i style z Figmy) —
 * skrypt nie ma dostępu do MCP. Dzięki temu podziałowi generowanie CSS jest
 * deterministyczne i testowalne bez Figmy. Schemat pliku: docs/figma/README.md.
 *
 * Decyzje warte uzasadnienia:
 * 1. Alias z Figmy zostaje aliasem w CSS — var(--fwp-blue-600), nie skopiowany hex.
 *    Zmiana palety to wtedy edycja jednej warstwy, a nie kilkudziesięciu wartości.
 * 2. Typografia i odstępy w rem (skalują się z ustawieniami użytkownika),
 *    wymiary layoutu w px (są związane z viewportem, nie z rozmiarem pisma).
 * 3. Warianty wagowe jednego stylu („Text sm/Regular”, „Text sm/Bold”) mają
 *    identyczną geometrię, więc dostają jeden komplet tokenów bez `-weight`;
 *    wagę niesie osobny, współdzielony token `--fwp-font-*`. Inaczej każdy
 *    rozmiar tekstu miałby cztery identyczne komplety tokenów.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve as resolvePath, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
const INPUT = resolvePath(ROOT, 'docs/figma/tokens.json');
const OUTPUT = resolvePath(ROOT, 'theme/assets/css/tokens.css');

// Nazwy wag wg nazewnictwa OpenType/CSS. Waga spoza tabeli nie dostaje tokenu
// `--fwp-font-*`, ale nadal trafia do `-weight` swojego stylu.
const FONT_WEIGHT_NAMES = {
  100: 'thin',
  200: 'extralight',
  300: 'light',
  400: 'regular',
  500: 'medium',
  600: 'semibold',
  700: 'bold',
  800: 'extrabold',
  900: 'black',
};

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function rgbaHexToCss(hex) {
  return String(hex).toLowerCase();
}

export function pxToRem(px, base = 16) {
  if (px === 0) {
    return '0';
  }
  const value = px / base;
  return `${parseFloat(value.toFixed(5))}rem`;
}

/** Nazwa stylu bez wagi (część po ostatnim ukośniku), jako klucz tokenu. */
export function typographyToken(name) {
  const withoutWeight = String(name).split('/').slice(0, -1).join('/') || String(name);
  return slugify(withoutWeight);
}

function styleGroupName(name) {
  return String(name).split('/').slice(0, -1).join('/').trim() || String(name).trim();
}

/**
 * Sprawdza kształt tokens.json i zwraca listę problemów (pusta = poprawny).
 * Plik wypełnia się ręcznie albo agentem, więc błąd musi mówić, KTÓRY wpis
 * jest zły — „Cannot read properties of undefined” nic by nie powiedziało.
 */
export function validateTokens(tokens) {
  const problems = [];
  if (!tokens || typeof tokens !== 'object') {
    return ['tokens.json nie jest obiektem JSON.'];
  }

  for (const key of ['primitives', 'semantic', 'typography']) {
    if (!Array.isArray(tokens[key])) {
      problems.push(`Brak tablicy "${key}".`);
    }
  }
  if (!tokens.layout || typeof tokens.layout !== 'object') {
    problems.push('Brak obiektu "layout".');
  }
  if (problems.length) {
    return problems;
  }

  tokens.primitives.forEach((p, i) => {
    if (!p.name) problems.push(`primitives[${i}]: brak "name".`);
    if (!HEX.test(p.hex ?? '')) problems.push(`primitives[${i}] "${p.name}": "hex" nie jest kolorem #rrggbb(aa).`);
  });

  tokens.semantic.forEach((s, i) => {
    if (!s.name) problems.push(`semantic[${i}]: brak "name".`);
    if (!s.alias && !HEX.test(s.hex ?? '')) {
      problems.push(`semantic[${i}] "${s.name}": potrzebny "alias" (nazwa prymitywu) albo "hex".`);
    }
  });

  tokens.typography.forEach((t, i) => {
    for (const prop of ['size', 'lineHeight', 'letterSpacing', 'weight']) {
      if (!Number.isFinite(t[prop])) {
        problems.push(`typography[${i}] "${t.name}": "${prop}" musi być liczbą.`);
      }
    }
    if (!t.name) problems.push(`typography[${i}]: brak "name".`);
    if (!t.family) problems.push(`typography[${i}] "${t.name}": brak "family".`);
  });

  const families = new Set(tokens.typography.map((t) => t.family));
  if (tokens.fonts != null && (typeof tokens.fonts !== 'object' || Array.isArray(tokens.fonts))) {
    problems.push('"fonts" musi być obiektem { rola: "Nazwa kroju" }.');
  } else {
    for (const [role, family] of Object.entries(tokens.fonts ?? {})) {
      if (!families.has(family)) {
        problems.push(`fonts.${role}: krój "${family}" nie występuje w żadnym stylu typography.`);
      }
    }
  }

  for (const prop of ['container', 'gutter', 'wrapper']) {
    if (!Number.isFinite(tokens.layout[prop])) {
      problems.push(`layout.${prop} musi być liczbą (px).`);
    }
  }
  if (!Array.isArray(tokens.layout.space) || tokens.layout.space.some((n) => !Number.isFinite(n))) {
    problems.push('layout.space musi być tablicą liczb (px).');
  }

  return problems;
}

/**
 * Interlinia jest bezmianowym mnożnikiem: rozmiar × mnożnik daje wysokość
 * wiersza w px. Figma podaje interlinię w pikselach, więc mnożnik zaokrąglony
 * do zbyt małej liczby miejsc (20/14 → 1.429) daje wiersz o ułamek piksela
 * za wysoki — niewidoczne w tokens.css, ale kumuluje się w wielowierszowym
 * tekście i przesuwa wszystko pod nim. Zwraca ostrzeżenia, nie błędy.
 */
export function lineHeightWarnings(typography, tolerancePx = 0.001) {
  const warnings = [];
  for (const t of typography) {
    const product = t.size * t.lineHeight;
    const rounded = Math.round(product);
    if (Math.abs(product - rounded) > tolerancePx) {
      warnings.push(
        `"${t.name}": ${t.size}px × ${t.lineHeight} = ${parseFloat(product.toFixed(4))}px ` +
          `(zapewne miało być ${rounded}px — podaj lineHeight z większą dokładnością, np. ` +
          `${parseFloat((rounded / t.size).toFixed(6))}).`
      );
    }
  }
  return warnings;
}

function assertConsistentGroup(groupName, entries) {
  const [first, ...rest] = entries;
  for (const entry of rest) {
    for (const prop of ['size', 'lineHeight', 'letterSpacing', 'family']) {
      if (entry[prop] !== first[prop]) {
        throw new Error(
          `Styl "${groupName}" ma niespójną geometrię między wariantami wagowymi: ` +
            `"${prop}" różni się (${first[prop]} vs ${entry[prop]}). Warianty jednego stylu ` +
            'mogą różnić się tylko wagą — inaczej nazwij je jako osobne style.'
        );
      }
    }
  }
}

function familyToken(family) {
  return `--fwp-font-family-${slugify(family)}`;
}

/**
 * Role krojów (np. body, heading) z opcjonalnego obiektu `fonts` w tokens.json.
 * Kod motywu odwołuje się do ról, nie do nazw krojów — zmiana pisma klienta
 * to wtedy zmiana jednego wpisu, a nie przeszukiwanie arkuszy.
 */
function collectFamilyRoles(fonts) {
  return Object.entries(fonts ?? {}).map(
    ([role, family]) => `--fwp-font-family-${slugify(role)}: var(${familyToken(family)});`
  );
}

function collectFamilyTokens(typography) {
  const seen = new Map();
  for (const t of typography) {
    if (!seen.has(t.family)) {
      seen.set(t.family, t.fallback ?? 'sans-serif');
    }
  }
  return [...seen.entries()].map(([family, fallback]) => `${familyToken(family)}: '${family}', ${fallback};`);
}

function collectFontWeightTokens(typography) {
  const weights = new Set(typography.map((t) => t.weight).filter((w) => FONT_WEIGHT_NAMES[w]));
  return [...weights].sort((a, b) => a - b).map((w) => `--fwp-font-${FONT_WEIGHT_NAMES[w]}: ${w};`);
}

function block(title, lines) {
  return [`  /* ${title} */`, ...lines.map((line) => `  ${line}`)].join('\n');
}

export function buildCss(tokens) {
  const problems = validateTokens(tokens);
  if (problems.length) {
    throw new Error(`docs/figma/tokens.json ma błędy:\n  - ${problems.join('\n  - ')}`);
  }

  const primitiveNames = new Set(tokens.primitives.map((p) => p.name));

  const primitives = tokens.primitives.map((p) => `--fwp-${slugify(p.name)}: ${rgbaHexToCss(p.hex)};`);

  const semantic = tokens.semantic.map((s) => {
    if (s.alias) {
      if (!primitiveNames.has(s.alias)) {
        throw new Error(`Token "${s.name}" wskazuje na alias "${s.alias}", którego nie ma wśród prymitywów.`);
      }
      return `--fwp-${slugify(s.name)}: var(--fwp-${slugify(s.alias)});`;
    }
    return `--fwp-${slugify(s.name)}: ${rgbaHexToCss(s.hex)};`;
  });

  // Grupowanie wariantów wagowych: klucz tokenu to nazwa stylu bez wagi.
  const groups = new Map();
  for (const t of tokens.typography) {
    const key = typographyToken(t.name);
    if (!groups.has(key)) {
      groups.set(key, { groupName: styleGroupName(t.name), entries: [] });
    }
    groups.get(key).entries.push(t);
  }

  const typography = [...groups.entries()].flatMap(([key, { groupName, entries }]) => {
    assertConsistentGroup(groupName, entries);
    const t = entries[0];
    const lines = [
      `--fwp-t-${key}-family: var(${familyToken(t.family)});`,
      `--fwp-t-${key}-size: ${pxToRem(t.size)};`,
      `--fwp-t-${key}-lh: ${t.lineHeight};`,
      `--fwp-t-${key}-ls: ${t.letterSpacing}em;`,
    ];
    // Jeden wariant — waga należy do stylu. Kilka wariantów — waga jest wyborem
    // w miejscu użycia, przez współdzielone --fwp-font-*.
    if (entries.length === 1) {
      lines.push(`--fwp-t-${key}-weight: ${t.weight};`);
    }
    return lines;
  });

  const fonts = [
    ...collectFamilyTokens(tokens.typography),
    ...collectFamilyRoles(tokens.fonts),
    ...collectFontWeightTokens(tokens.typography),
  ];

  const space = tokens.layout.space.map((n) => `--fwp-space-${n}: ${pxToRem(n)};`);

  const layout = [
    `--fwp-container: ${tokens.layout.container}px;`,
    `--fwp-gutter: ${tokens.layout.gutter}px;`,
    `--fwp-wrapper: ${tokens.layout.wrapper}px;`,
  ];

  const source = tokens.meta?.generatedAt
    ? `Wygenerowano z danych z: ${tokens.meta.generatedAt}`
    : 'Dane z szablonu — tokeny nie zostały jeszcze wyciągnięte z Figmy.';

  return [
    '/*',
    ' * PLIK GENEROWANY — nie edytuj ręcznie.',
    ' * Źródło: docs/figma/tokens.json',
    ' * Generator: tools/tokens-to-css.mjs (npm run tokens)',
    ` * ${source}`,
    ' */',
    '',
    ':root {',
    block('Prymitywy — używane wyłącznie w aliasach poniżej', primitives),
    '',
    block('Kolory semantyczne — tych używaj w kodzie', semantic),
    '',
    block('Kroje i wagi', fonts),
    '',
    block('Typografia', typography),
    '',
    block('Odstępy', space),
    '',
    block('Layout', layout),
    '}',
    '',
  ].join('\n');
}

function main() {
  const tokens = JSON.parse(readFileSync(INPUT, 'utf8'));
  const css = buildCss(tokens);
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, css, 'utf8');
  const count = (css.match(/^\s*--fwp-/gm) || []).length;
  console.log(`Zapisano ${relative(ROOT, OUTPUT)} (${count} custom properties).`);

  for (const warning of lineHeightWarnings(tokens.typography)) {
    console.warn(`OSTRZEŻENIE interlinii: ${warning}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
