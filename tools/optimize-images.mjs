#!/usr/bin/env node
/**
 * Przygotowuje grafiki do użycia w motywie.
 *
 * Każdy raster (JPG, PNG) dostaje wariant WebP i kopię w formacie źródłowym jako
 * zapasową — <picture> podaje WebP, a starsze przeglądarki dostają oryginał.
 * PNG zostaje PNG-iem, bo logotypy i ikony rastrowe potrzebują przezroczystości.
 * SVG przechodzi bez zmian. Struktura podkatalogów jest zachowana, sufiks
 * gęstości (@2x) przechodzi do nazwy wynikowej.
 *
 * Domyślnie czyta surowe eksporty z npm run figma:assets (design-assets/raw/,
 * poza motywem — żeby nie trafiły na serwer) i zapisuje do theme/assets/img/.
 *
 * Użycie: npm run images [-- --src design-assets/raw --out theme/assets/img]
 */

import { readdirSync, statSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_SRC = 'design-assets/raw';
export const DEFAULT_OUT = 'theme/assets/img';
const RASTER = new Set(['.jpg', '.jpeg', '.png']);
const WEBP_OPTIONS = { quality: 82, effort: 5 };

export function isRetina(path) {
  return /@\d+(\.\d+)?x\.[a-z0-9]+$/i.test(path);
}

/**
 * Lista plików wynikowych dla pliku źródłowego (ścieżka względna wobec
 * katalogu źródłowego). Pusta lista = plik pomijany.
 */
export function planVariants(relativePath) {
  const extension = extname(relativePath).toLowerCase();
  const stem = relativePath.slice(0, -extension.length);

  if (extension === '.svg') {
    return [{ out: relativePath, format: 'copy' }];
  }

  if (!RASTER.has(extension)) {
    return [];
  }

  return [
    { out: `${stem}.webp`, format: 'webp' },
    { out: relativePath, format: 'copy' },
  ];
}

export function parseImageArgs(argv) {
  const opts = { src: DEFAULT_SRC, out: DEFAULT_OUT };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--src') {
      opts.src = argv[++i];
    } else if (argv[i] === '--out') {
      opts.out = argv[++i];
    } else {
      throw new Error(`Nieznany argument ${argv[i]}. Użycie: npm run images [-- --src KATALOG --out KATALOG]`);
    }
  }
  if (!opts.src || !opts.out) {
    throw new Error('--src i --out wymagają wartości.');
  }
  return opts;
}

function walk(directory, skip) {
  const entries = [];
  for (const name of readdirSync(directory)) {
    if (name.startsWith('.')) {
      continue;
    }
    const full = join(directory, name);
    if (full === skip) {
      continue;
    }
    if (statSync(full).isDirectory()) {
      entries.push(...walk(full, skip));
    } else {
      entries.push(full);
    }
  }
  return entries;
}

async function main() {
  const opts = parseImageArgs(process.argv.slice(2));
  const source = isAbsolute(opts.src) ? opts.src : resolvePath(ROOT, opts.src);
  const target = isAbsolute(opts.out) ? opts.out : resolvePath(ROOT, opts.out);

  if (!existsSync(source)) {
    throw new Error(`Brak katalogu ${relative(ROOT, source)} — najpierw npm run figma:assets albo podaj --src.`);
  }
  if (source === target) {
    throw new Error('--src i --out muszą być różnymi katalogami.');
  }

  const { default: sharp } = await import('sharp');
  let written = 0;

  // Gdy katalog wynikowy leży wewnątrz źródłowego, pomijamy go — inaczej
  // kolejne uruchomienie przetwarzałoby własne wyniki.
  for (const file of walk(source, target)) {
    const rel = relative(source, file);

    for (const variant of planVariants(rel)) {
      const out = resolvePath(target, variant.out);
      mkdirSync(dirname(out), { recursive: true });

      if (variant.format === 'webp') {
        await sharp(file).webp(WEBP_OPTIONS).toFile(out);
      } else {
        copyFileSync(file, out);
      }

      written++;
    }
  }

  console.log(`Zapisano ${written} plików do ${relative(ROOT, target)}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
