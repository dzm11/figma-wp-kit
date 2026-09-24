#!/usr/bin/env node
/**
 * Eksportuje grafiki (ikony, logotypy, zdjęcia, ilustracje) z Figmy przez REST API.
 *
 * Wiele węzłów idzie w jednym żądaniu — API przyjmuje listę identyfikatorów,
 * a każde osobne żądanie zjada limit zapytań. Nazwy plików pochodzą z nazw
 * warstw w Figmie (albo z --nazwa), zamienionych na bezpieczne nazwy plików.
 *
 * Domyślnie zapisuje do design-assets/raw/ — poza motywem, bo surowe eksporty
 * (duże PNG w skali 2, PDF-y) nie mogą trafić na serwer razem z theme/.
 * Do motywu grafiki przenosi dopiero npm run images (WebP + oryginał).
 *
 * Użycie:
 *   npm run figma:assets -- <nodeId...> [--format svg|png|jpg|pdf] [--scale 2]
 *                           [--out design-assets/raw] [--nazwa a,b,...]
 *                           [--svg-outline-text true|false]
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { isAbsolute, resolve as resolvePath, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FORMATS,
  parseNodeArg,
  normalizeNodeId,
  fetchImageUrls,
  fetchNodeDocuments,
  downloadBuffer,
  resolveToken,
} from './figma-export.mjs';
import { ROOT, readProjekt, requireFileKey } from './lib/projekt.mjs';

export const DEFAULT_OUT = 'design-assets/raw';

export const HELP = `Eksportuje grafiki z Figmy (REST API) do surowego katalogu poza motywem.

Użycie: npm run figma:assets -- <nodeId...> [opcje]

  <nodeId...>              jeden lub więcej: 12-345 (z URL-a), 12:345 (z API)
                           albo cały link z parametrem node-id
  --format svg|png|jpg|pdf domyślnie png
  --scale N                0.01–4, domyślnie 1; dla png/jpg skala ≠ 1 dodaje
                           do nazwy sufiks @Nx (np. logo@2x.png)
  --out KATALOG            domyślnie ${DEFAULT_OUT}
  --nazwa a,b,...          nazwy plików zamiast nazw warstw (w kolejności węzłów;
                           można też powtórzyć --nazwa dla każdego węzła)
  --svg-outline-text B     true zamienia tekst w SVG na krzywe; domyślnie false,
                           żeby tekst pozostał tekstem (mniejszy plik, dostępność)

Przykład: npm run figma:assets -- 12-345 12-346 --format svg --nazwa logo,ikona-strzalka`;

/**
 * Zamienia nazwę warstwy z Figmy na nazwę pliku: małe litery, bez polskich
 * znaków (serwery i narzędzia budujące różnie obchodzą się z Unicode
 * w ścieżkach), myślniki zamiast wszystkiego innego.
 */
export function slugifyName(name) {
  const slug = String(name)
    .replace(/[łŁ]/g, 'l')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'grafika';
}

function parseBool(value, flag) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${flag} przyjmuje true albo false (jest: ${value}).`);
}

export function parseAssetArgs(argv) {
  const opts = {
    ids: [],
    format: 'png',
    scale: 1,
    out: DEFAULT_OUT,
    names: [],
    svgOutlineText: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) {
        throw new Error(`Brak wartości po ${arg}.`);
      }
      return value;
    };

    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--format') {
      opts.format = next().toLowerCase();
    } else if (arg === '--scale') {
      opts.scale = Number(next());
    } else if (arg === '--out') {
      opts.out = next();
    } else if (arg === '--nazwa') {
      opts.names.push(...next().split(',').map((n) => n.trim()).filter(Boolean));
    } else if (arg === '--svg-outline-text') {
      opts.svgOutlineText = parseBool(next(), arg);
    } else if (arg.startsWith('--')) {
      throw new Error(`Nieznana opcja ${arg}. Zobacz --help.`);
    } else {
      opts.ids.push(parseNodeArg(arg));
    }
  }

  if (opts.help) {
    return opts;
  }
  if (opts.ids.length === 0) {
    throw new Error('Podaj co najmniej jeden identyfikator węzła. Zobacz --help.');
  }
  if (opts.format === 'jpeg') {
    opts.format = 'jpg';
  }
  if (!FORMATS.includes(opts.format)) {
    throw new Error(`Nieznany format "${opts.format}"; dostępne: ${FORMATS.join(', ')}.`);
  }
  if (!(opts.scale >= 0.01 && opts.scale <= 4)) {
    throw new Error(`Nieprawidłowa skala ${opts.scale}; Figma API przyjmuje zakres 0.01–4.`);
  }
  // Ten sam węzeł podany dwa razy dałby dwa identyczne pliki.
  opts.ids = [...new Set(opts.ids)];
  if (opts.names.length > 0 && opts.names.length !== opts.ids.length) {
    throw new Error(
      `Liczba nazw (${opts.names.length}) nie zgadza się z liczbą węzłów (${opts.ids.length}).`
    );
  }
  return opts;
}

/** Dodatkowe parametry żądania eksportu zależne od formatu. */
export function exportExtra(format, svgOutlineText = false) {
  if (format !== 'svg') {
    return {};
  }
  // svg_include_id=false: identyfikatory warstw w SVG to śmieci z Figmy, które
  // kolidują ze sobą przy wstawieniu kilku grafik inline na jedną stronę.
  return { svg_outline_text: svgOutlineText, svg_include_id: false };
}

/**
 * Plan zapisu: dla każdego węzła nazwa pliku — z `names` (Map id -> nazwa
 * podana przez użytkownika), a w drugiej kolejności z nazwy warstwy. Kolizje nazw (dwie warstwy
 * „Icon”) dostają kolejne numery, żeby jeden plik nie nadpisał drugiego.
 */
export function planFiles(ids, layerNames, { format, scale = 1, names = new Map() }) {
  const used = new Map();
  const raster = format === 'png' || format === 'jpg';
  const suffix = raster && scale !== 1 ? `@${scale}x` : '';

  return ids.map((id) => {
    const base = slugifyName(names.get(id) ?? layerNames.get(id) ?? id);
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    const stem = count === 1 ? base : `${base}-${count}`;
    return { id, file: `${stem}${suffix}.${format}` };
  });
}

async function main() {
  const opts = parseAssetArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(HELP);
    return;
  }

  const fileKey = requireFileKey(readProjekt());
  const token = resolveToken();
  const outDir = isAbsolute(opts.out) ? opts.out : resolvePath(ROOT, opts.out);

  // Nazwy warstw — głębokość 1 wystarcza, potrzebujemy tylko samych węzłów.
  const documents = await fetchNodeDocuments(fileKey, opts.ids, { token, depth: 1 });
  const layerNames = new Map();
  for (const id of opts.ids) {
    const document = documents.get(normalizeNodeId(id));
    if (document) {
      layerNames.set(id, document.name);
    } else {
      console.warn(`OSTRZEŻENIE: węzeł ${id} nie istnieje w pliku (albo brak do niego dostępu) — pomijam.`);
    }
  }

  const existing = opts.ids.filter((id) => layerNames.has(id));
  if (existing.length === 0) {
    throw new Error('Żaden z podanych węzłów nie istnieje w pliku — sprawdź identyfikatory.');
  }

  const plan = planFiles(existing, layerNames, {
    format: opts.format,
    scale: opts.scale,
    names: new Map(opts.names.map((name, index) => [opts.ids[index], name])),
  });

  const images = await fetchImageUrls(fileKey, existing, {
    token,
    format: opts.format,
    scale: opts.scale,
    extra: exportExtra(opts.format, opts.svgOutlineText),
  });

  mkdirSync(outDir, { recursive: true });
  let saved = 0;

  for (const { id, file } of plan) {
    const url = images[id];
    if (!url) {
      console.warn(
        `OSTRZEŻENIE: Figma nie wyrenderowała węzła ${id} („${layerNames.get(id)}”) — ` +
          'jest pusty, niewidoczny albo ma zerowy rozmiar. Pomijam.'
      );
      continue;
    }
    const buffer = await downloadBuffer(url);
    const path = resolvePath(outDir, file);
    writeFileSync(path, buffer);
    saved++;
    console.log(`${id}  „${layerNames.get(id)}”  ->  ${relative(ROOT, path)} (${Math.round(buffer.length / 1024)} kB)`);
  }

  console.log(`Zapisano ${saved} z ${opts.ids.length} grafik do ${relative(ROOT, outDir) || '.'}.`);
  if (saved === 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
