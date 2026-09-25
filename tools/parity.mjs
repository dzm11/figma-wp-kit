#!/usr/bin/env node
/**
 * Porównuje render sekcji w przeglądarce z eksportem jej węzła z Figmy.
 *
 * Porównanie jest dwutorowe, bo pojedynczy wskaźnik kłamie w obie strony:
 * różnica pikseli wyłapie złe kolory i odstępy, ale utonie w szumie renderowania tekstu;
 * porównanie geometrii jest odporne na ten szum, ale nie zauważy złego koloru.
 *
 * Kolejność przetwarzania ma znaczenie i każdy krok istnieje z konkretnego powodu:
 *
 *  1. przycięcie referencji do ramki węzła (pole `crop`) — eksport z Figmy bywa
 *     większy niż ramka, gdy coś wystaje poza nią;
 *  2. przycięcie zrzutu do warstwy treści (pole `area`) — węzeł w Figmie mierzy
 *     kontener treści, a selektor sekcji łapie pełnoekranowy element;
 *  3. spłaszczenie referencji na tło — sekcje bez własnego tła eksportują się
 *     jako przezroczyste PNG, a zrzut z przeglądarki zawsze jest nieprzezroczysty;
 *  4. maski tekstu — antyaliasingu liter dwa różne rasteryzatory nigdy nie uzgodnią,
 *     więc tekst wyłączamy z porównania pikselowego i pilnujemy go geometrią.
 *
 * Kroki 3 i 4 muszą dostać obraz już w układzie porównywanego obszaru, dlatego
 * przycinanie idzie pierwsze.
 *
 * Użycie: npm run parity -- <slug> [--mobile]
 */

import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  refPath,
  readNodes,
  downloadReference,
  resolveToken,
  sumVisibleBoundingBoxes,
  computeCropOffset,
} from './figma-export.mjs';
import { readProjekt, requireFileKey, baseUrl, viewportPorownania } from './lib/projekt.mjs';

// Funkcje liczące przycięcie referencji żyją przy pobieraniu referencji
// (figma-export.mjs), bo tam są używane; eksportujemy je także stąd, bo należą
// do tego samego mechanizmu porównania.
export { sumVisibleBoundingBoxes, computeCropOffset };

const MASK_COLOR = [255, 0, 255];
const SECTION_PREFIX = 'home-';
const DIFF_RATIO_THRESHOLD = 0.02;

// Margines wokół maski tekstu w pikselach CSS, na każdą stronę prostokąta.
// Same prostokąty liter z getClientRects() nie wystarczają — antyaliasing
// i podpiksele czcionki wychodzą poza nie. Zweryfikowane empirycznie: 2 px
// sprowadza szum liter w typowym nagłówku z blisko 3% do dziesiątych części
// procenta, a większy margines niczego już nie poprawia — reszta różnicy
// jest wtedy prawdziwą rozbieżnością układu, nie szumem.
const MARGIN_CSS_PX = 2;

// Referencje z Figmy eksportujemy w skali 1, a strona jest otwierana
// z deviceScaleFactor: 1 właśnie po to, żeby ta stała była jedynym miejscem
// prawdy o skali — inaczej przeliczenie masek na piksele zrzutu rozjechałoby
// się z rzeczywistą skalą strony przy jakiejkolwiek zmianie.
const DEVICE_SCALE_FACTOR = 1;

// Maska pokrywająca więcej niż 40% powierzchni sekcji czyni porównanie
// pikselowe bezwartościowym — zgłaszamy to jako ostrzeżenie, nie błąd.
const MASK_COVERAGE_WARNING_RATIO = 0.4;

// Rozjazd pozycji lub rozmiaru > 4 px to blocker, niezależnie od wyniku
// porównania pikselowego. Progów się nie luzuje — jeśli wartości z Figmy nie da
// się osiągnąć, to jest ustalenie do zgłoszenia, nie do obejścia.
const GEOMETRY_TOLERANCE_PX = 4;

// Skupiska różnic: kafelek HOTSPOT_TILE_PX × HOTSPOT_TILE_PX, w którym różni się
// ponad HOTSPOT_MIN_RATIO pikseli, to błąd bez względu na średnią dla sekcji.
// Kalibracja na sekcji wzorcowej: poprawny render ma najgorszy
// kafelek poniżej progu, a 6 pigułek przesuniętych o 20 px (0,43% całości,
// czyli „OK” wg progu 2%) daje kafelki powyżej. Tekst jest zamaskowany,
// więc szum liter nie tworzy skupisk.
const HOTSPOT_TILE_PX = 48;
const HOTSPOT_MIN_RATIO = 0.2;

/**
 * Przycina prostokąt do granic obrazu i zaokrągla współrzędne do pikseli.
 * Współdzielone przez applyMasks (malowanie) i maskCoverageRatio (liczenie
 * pokrycia) — obie ścieżki muszą operować na dokładnie tych samych pikselach,
 * inaczej zgłoszone pokrycie nie odpowiadałoby temu, co faktycznie zamaskowano.
 */
function clampRectToBounds(rect, width, height) {
  return {
    xStart: Math.max(0, Math.round(rect.x)),
    yStart: Math.max(0, Math.round(rect.y)),
    xEnd: Math.min(width, Math.round(rect.x + rect.width)),
    yEnd: Math.min(height, Math.round(rect.y + rect.height)),
  };
}

export function applyMasks(png, rects = []) {
  for (const rect of rects) {
    const { xStart, yStart, xEnd, yEnd } = clampRectToBounds(rect, png.width, png.height);

    for (let y = yStart; y < yEnd; y++) {
      for (let x = xStart; x < xEnd; x++) {
        const index = (png.width * y + x) << 2;
        png.data[index] = MASK_COLOR[0];
        png.data[index + 1] = MASK_COLOR[1];
        png.data[index + 2] = MASK_COLOR[2];
        png.data[index + 3] = 255;
      }
    }
  }

  return png;
}

/**
 * Przelicza prostokąt tekstu zmierzony w przeglądarce (Range.getClientRects(),
 * współrzędne względem viewportu, w pikselach CSS) na prostokąt maski względem
 * lewego górnego rogu porównywanego obszaru i w skali zrzutu ekranu.
 *
 * Margines dodaje się PRZED przeskalowaniem, w pikselach CSS — tak mierzy się
 * antyaliasing niezależnie od skali zrzutu.
 */
export function toMaskRect(clientRect, sectionOrigin, margin = 0, scale = 1) {
  return {
    x: (clientRect.x - sectionOrigin.x - margin) * scale,
    y: (clientRect.y - sectionOrigin.y - margin) * scale,
    width: (clientRect.width + margin * 2) * scale,
    height: (clientRect.height + margin * 2) * scale,
  };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function unionRect(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * Scala nachodzące się prostokąty w ich sumy brzegowe. Po rozszerzeniu
 * o margines sąsiednie linie tekstu (albo sąsiednie litery w tej samej linii)
 * często zaczynają się nakładać. Scalanie jest przechodnie: jeśli A nachodzi
 * na B, a B na C, całość trafia do jednego prostokąta, nawet gdy A i C same
 * w sobie się nie stykają.
 */
export function mergeOverlappingRects(rects) {
  const merged = rects.slice();
  let changed = true;

  while (changed) {
    changed = false;
    outer: for (let i = 0; i < merged.length; i++) {
      for (let j = i + 1; j < merged.length; j++) {
        if (rectsOverlap(merged[i], merged[j])) {
          const union = unionRect(merged[i], merged[j]);
          merged.splice(j, 1);
          merged.splice(i, 1, union);
          changed = true;
          break outer;
        }
      }
    }
  }

  return merged;
}

/**
 * Przycina PNG do prostokąta `rect` (współrzędne w układzie samego obrazu).
 * Używane dwukrotnie: do sprowadzenia eksportu z Figmy do ramki węzła i do
 * przycięcia zrzutu z przeglądarki do warstwy treści.
 *
 * Prostokąt wychodzący poza obraz to błąd konfiguracji (np. nieaktualne pole
 * `crop` po zmianie makiety) — zgłaszamy go, zamiast po cichu czytać śmieci.
 */
export function cropPng(buffer, rect) {
  const source = PNG.sync.read(buffer);

  if (
    rect.x < 0 ||
    rect.y < 0 ||
    rect.width <= 0 ||
    rect.height <= 0 ||
    rect.x + rect.width > source.width ||
    rect.y + rect.height > source.height
  ) {
    throw new Error(
      `Prostokąt przycięcia ${JSON.stringify(rect)} wychodzi poza obraz ${source.width}x${source.height}. ` +
        'Jeśli to pole "crop" z nodes.json, pobierz referencję ponownie (npm run figma:ref).'
    );
  }

  const out = new PNG({ width: rect.width, height: rect.height });

  for (let y = 0; y < rect.height; y++) {
    for (let x = 0; x < rect.width; x++) {
      const srcIndex = (source.width * (y + rect.y) + (x + rect.x)) << 2;
      const dstIndex = (rect.width * y + x) << 2;
      out.data[dstIndex] = source.data[srcIndex];
      out.data[dstIndex + 1] = source.data[srcIndex + 1];
      out.data[dstIndex + 2] = source.data[srcIndex + 2];
      out.data[dstIndex + 3] = source.data[srcIndex + 3];
    }
  }

  return PNG.sync.write(out);
}

/**
 * Liczy, jaki ułamek powierzchni sekcji pokrywają podane prostokąty masek.
 * Liczy realnie pokryte piksele (siatka odwiedzin), a nie sumę pól
 * prostokątów, więc nachodzące się prostokąty nie zawyżają wyniku —
 * mergeOverlappingRects() jest tu tylko optymalizacją, nie warunkiem
 * poprawności.
 */
export function maskCoverageRatio(rects, width, height) {
  if (width * height === 0) {
    return 0;
  }

  const covered = new Uint8Array(width * height);
  let count = 0;

  for (const rect of rects) {
    const { xStart, yStart, xEnd, yEnd } = clampRectToBounds(rect, width, height);
    for (let y = yStart; y < yEnd; y++) {
      for (let x = xStart; x < xEnd; x++) {
        const index = y * width + x;
        if (!covered[index]) {
          covered[index] = 1;
          count++;
        }
      }
    }
  }

  return count / (width * height);
}

/**
 * Powyżej progu test przestaje cokolwiek weryfikować, bo prawie cała sekcja
 * jest wyłączona z porównania. To ostrzeżenie, nie błąd — nie wpływa na kod wyjścia.
 */
export function isCoverageExcessive(ratio, threshold = MASK_COVERAGE_WARNING_RATIO) {
  return ratio > threshold;
}

/**
 * Rozbiera CSS-owy zapis koloru ("rgb(r, g, b)" albo "rgba(r, g, b, a)") na
 * składowe. Zwraca null dla wartości nierozpoznanych. Czysta funkcja — parsuje
 * wynik getComputedStyle() zwrócony z przeglądarki, ale sama przeglądarki
 * nie potrzebuje.
 */
export function parseRgbColor(value) {
  const match = /rgba?\(([^)]+)\)/.exec(value ?? '');
  if (!match) {
    return null;
  }

  const parts = match[1].split(',').map((part) => parseFloat(part.trim()));
  const [r, g, b, a = 1] = parts;

  if ([r, g, b].some((n) => Number.isNaN(n))) {
    return null;
  }

  return { r, g, b, a };
}

/**
 * Spłaszcza obraz z kanałem alfa na wskazane, nieprzezroczyste tło (standardowa
 * kompozycja „źródło nad tłem”: wynik = źródło*alfa + tło*(1-alfa), alfa wyniku
 * pełna).
 *
 * Referencje eksportowane z Figmy dla węzłów bez własnego wypełnienia mają
 * przezroczyste tło, a zrzut z przeglądarki jest zawsze nieprzezroczysty
 * (renderuje się na tle strony). Bez spłaszczenia porównanie wykazuje niemal
 * 100% różnicy niezależnie od tego, co faktycznie narysowano (dziura kontra
 * brak dziury). Większość sekcji nie ma własnego tła, więc bez tego kroku
 * porównanie zawsze zgłaszałoby porażkę — a narzędzie, które zawsze
 * zgłasza porażkę, jest równie bezużyteczne jak to, które zawsze przechodzi.
 *
 * Zwraca NOWY bufor i nie mutuje `refBuffer` — referencja na dysku ma zostać
 * wiernym eksportem z Figmy, spłaszczanie dzieje się wyłącznie na kopii w pamięci.
 */
export function flattenOnBackground(refBuffer, [bgR, bgG, bgB]) {
  const source = PNG.sync.read(refBuffer);
  const out = new PNG({ width: source.width, height: source.height });

  for (let i = 0; i < source.width * source.height; i++) {
    const idx = i * 4;
    const alpha = source.data[idx + 3] / 255;

    out.data[idx] = Math.round(source.data[idx] * alpha + bgR * (1 - alpha));
    out.data[idx + 1] = Math.round(source.data[idx + 1] * alpha + bgG * (1 - alpha));
    out.data[idx + 2] = Math.round(source.data[idx + 2] * alpha + bgB * (1 - alpha));
    out.data[idx + 3] = 255;
  }

  return PNG.sync.write(out);
}

/**
 * Ustala tło, na którym element faktycznie się renderuje: kolor tła samego
 * elementu, a jeśli jest przezroczysty (alfa 0) — pierwszego przodka, który
 * przezroczysty nie jest. Gdy żaden się nie znajdzie, bierze tło body.
 *
 * Chodzenie po DOM musi się odbyć w przeglądarce, więc decyzja „czy ten kolor
 * jest wystarczająco nieprzezroczysty, żeby się zatrzymać” jest zduplikowana
 * inline w evaluate — samo parsowanie końcowego koloru robi przetestowany
 * parseRgbColor() w Node.
 */
async function resolveBackgroundColor(elementHandle) {
  const colorString = await elementHandle.evaluate((el) => {
    let node = el;
    while (node) {
      const value = getComputedStyle(node).backgroundColor;
      const match = /rgba?\(([^)]+)\)/.exec(value);
      if (match) {
        const parts = match[1].split(',').map((part) => parseFloat(part));
        const alpha = parts.length === 4 ? parts[3] : 1;
        if (alpha > 0) {
          return value;
        }
      }
      node = node.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  });

  const parsed = parseRgbColor(colorString);
  if (!parsed) {
    // Nie powinno się zdarzyć (getComputedStyle zawsze zwraca rgb()/rgba()),
    // a białe tło jest najbezpieczniejszym domysłem dla strony.
    return [255, 255, 255];
  }

  return [Math.round(parsed.r), Math.round(parsed.g), Math.round(parsed.b)];
}

/** Wycina lewy górny prostokąt width × height z odczytanego PNG. */
function trimPng(png, width, height) {
  if (png.width === width && png.height === height) {
    return png;
  }
  const out = new PNG({ width, height });
  PNG.bitblt(png, out, 0, 0, width, height, 0, 0);
  return out;
}

export function comparePng(refBuffer, actualBuffer, opts = {}) {
  let reference = PNG.sync.read(refBuffer);
  let actual = PNG.sync.read(actualBuffer);

  // Różnica o 1 px w osi to zaokrąglenie zrzutu elementu leżącego na ułamkowej
  // pozycji (sekcja nad nim ma np. ułamkową wysokość), nie rozjazd układu.
  const dw = Math.abs(reference.width - actual.width);
  const dh = Math.abs(reference.height - actual.height);
  let subpixelTrim = false;
  if ((dw || dh) && dw <= 1 && dh <= 1) {
    const width = Math.min(reference.width, actual.width);
    const height = Math.min(reference.height, actual.height);
    reference = trimPng(reference, width, height);
    actual = trimPng(actual, width, height);
    subpixelTrim = true;
  }

  if (reference.width !== actual.width || reference.height !== actual.height) {
    return {
      sizeMismatch: true,
      diffPixels: Infinity,
      diffRatio: 1,
      total: reference.width * reference.height,
      diff: null,
      message:
        `Rozjazd wymiarów: Figma ${reference.width}x${reference.height}, ` +
        `przeglądarka ${actual.width}x${actual.height}.`,
    };
  }

  const diff = new PNG({ width: reference.width, height: reference.height });
  const diffPixels = pixelmatch(
    reference.data,
    actual.data,
    diff.data,
    reference.width,
    reference.height,
    { threshold: opts.threshold ?? 0.1, includeAA: false }
  );

  const total = reference.width * reference.height;

  return {
    sizeMismatch: false,
    subpixelTrim,
    diffPixels,
    diffRatio: diffPixels / total,
    total,
    diff: PNG.sync.write(diff),
    message: null,
  };
}

/**
 * Kafelki obrazu różnic (wynik pixelmatch), w których różni się duża część
 * pikseli. Średnia dla całej sekcji chowa błąd małego elementu — przesunięta
 * pigułka zajmuje ułamek procenta sekcji, ale w swoim kafelku jest jaskrawa.
 *
 * pixelmatch maluje różnicę na czerwono (255, 0, 0); antyaliasing (includeAA:
 * false) na żółto i nie jest liczony.
 */
export function findHotspots(diffBuffer, { tile = HOTSPOT_TILE_PX, minRatio = HOTSPOT_MIN_RATIO } = {}) {
  if (!diffBuffer) {
    return [];
  }
  const diff = PNG.sync.read(diffBuffer);
  const hotspots = [];

  for (let ty = 0; ty < diff.height; ty += tile) {
    for (let tx = 0; tx < diff.width; tx += tile) {
      const w = Math.min(tile, diff.width - tx);
      const h = Math.min(tile, diff.height - ty);
      let count = 0;
      for (let y = ty; y < ty + h; y++) {
        for (let x = tx; x < tx + w; x++) {
          const i = (y * diff.width + x) * 4;
          if (diff.data[i] === 255 && diff.data[i + 1] === 0 && diff.data[i + 2] === 0) {
            count++;
          }
        }
      }
      const ratio = count / (w * h);
      if (ratio > minRatio) {
        hotspots.push({ x: tx, y: ty, width: w, height: h, ratio });
      }
    }
  }

  return hotspots.sort((a, b) => b.ratio - a.ratio);
}

export function assertGeometry(expected, actual, tolerance = GEOMETRY_TOLERANCE_PX) {
  const found = new Map(actual.map((box) => [box.name, box]));
  const problems = [];

  for (const want of expected) {
    const got = found.get(want.name);

    if (!got) {
      problems.push(`"${want.name}": brak elementu w renderze, a jest w Figmie.`);
      continue;
    }

    for (const property of ['x', 'y', 'width', 'height']) {
      const delta = Math.abs(want[property] - got[property]);
      if (delta > tolerance) {
        problems.push(
          `"${want.name}" ${property}: Figma ${want[property]}, ` +
            `przeglądarka ${got[property]} (rozjazd ${delta.toFixed(1)} px, tolerancja ${tolerance}).`
        );
      }
    }
  }

  return problems;
}

/**
 * Konfiguracja obszaru porównania (pole "area") dla sluga i breakpointu.
 *
 * Węzeł w Figmie zwykle mierzy warstwę treści (wrapper albo kontener), a selektor
 * sekcji w przeglądarce łapie pełnoekranowy element, bo tło rozciąga się na całą
 * szerokość viewportu. Bez przycięcia zrzutu do tej samej warstwy porównanie
 * szerokości fałszywie przewracałoby się na każdej takiej sekcji, choć treść
 * zaczyna się dokładnie tam, gdzie powinna.
 *
 * Dwie formy zapisu:
 *   "area": { "selector": ".fwp-container" }                 — dla obu breakpointów,
 *   "area": { "selector": ".fwp-container", "mobile": null }  — nadpisanie per breakpoint
 *                                                              (null = bez przycinania).
 *
 * Brak pola zwraca null — zrzut zostaje pełnej szerokości sekcji. To właściwe
 * dla elementów, których węzeł w Figmie obejmuje całą szerokość (nagłówek, stopka).
 */
export function areaConfigFor(slug, nodes, breakpoint = 'desktop') {
  const area = nodes[slug]?.area;
  if (!area) {
    return null;
  }
  if (Object.hasOwn(area, breakpoint)) {
    return area[breakpoint] ?? null;
  }
  return area.selector ? { selector: area.selector } : null;
}

/**
 * Wyznacza poziomy obszar porównania w układzie viewportu (piksele CSS): albo
 * realny prostokąt elementu warstwy treści zmierzony w przeglądarce, albo —
 * gdy sekcja takiego elementu nie zawiera — wariant zapasowy wyśrodkowany
 * w viewporcie.
 *
 * Wariant zapasowy NIE zgaduje szerokości: `fallbackWidth` to realna szerokość
 * referencji z Figmy (już przyciętej do ramki węzła), więc przycięty zrzut
 * zawsze wyjdzie tej samej szerokości co referencja. Jedynym domysłem jest
 * POZYCJA (środek viewportu) i to właśnie sygnalizuje `usedFallback`.
 */
export function resolveHorizontalArea(elementRect, fallbackWidth, viewportWidth) {
  if (elementRect) {
    return { x: elementRect.x, width: elementRect.width, usedFallback: false };
  }

  return { x: (viewportWidth - fallbackWidth) / 2, width: fallbackWidth, usedFallback: true };
}

/**
 * Przelicza obszar (współrzędne viewportu, piksele CSS) na prostokąt przycięcia
 * zrzutu z przeglądarki: odejmuje początek sekcji — zrzut zaczyna się od
 * lewego górnego rogu ELEMENTU sekcji, nie viewportu — i przeskalowuje do
 * pikseli zrzutu. Przycina wynik do granic obrazu, żeby pomiar rozjechany
 * o ułamek piksela nie wyszedł poza bufor.
 *
 * Przycinamy WYŁĄCZNIE w poziomie: różnica wysokości to prawdziwy sygnał
 * o układzie, którego nie wolno zamiatać pod dywan.
 */
export function areaToCropRect(area, sectionBox, actualWidthPx, actualHeightPx, scale = 1) {
  const xStart = Math.max(0, Math.round((area.x - sectionBox.x) * scale));
  const width = Math.max(0, Math.min(actualWidthPx - xStart, Math.round(area.width * scale)));

  return { x: xStart, y: 0, width, height: actualHeightPx };
}

/**
 * Punkt odniesienia dla masek tekstu po ewentualnym przycięciu w poziomie.
 * Gdy sekcja ma skonfigurowany `area`, lewa krawędź porównywanych obrazów to
 * lewa krawędź TEGO obszaru, nie sekcji — inaczej maski wylądują przesunięte
 * o offset. Oś Y nie jest przycinana, więc zawsze zostaje originem sekcji.
 */
export function resolveMaskOrigin(area, sectionBox) {
  if (!area) {
    return sectionBox;
  }

  return { x: area.x, y: sectionBox.y };
}

/**
 * Wyprowadza selektor CSS dla sluga z docs/figma/nodes.json. Dwie ścieżki:
 *
 *  - jawne pole "selector" na wpisie — dla elementów obramowania strony
 *    (nagłówek, stopka, pasek ogłoszeń), które nie są sekcjami strony głównej;
 *  - derywacja z przedrostka "home-" (np. "home-hero" -> ".fwp-hero") — dla
 *    sekcji strony głównej, zgodnie z konwencją nazw plików sekcji.
 *
 * Jawne pole ma pierwszeństwo.
 */
export function sectionSelector(slug, nodes) {
  const entry = nodes[slug];

  if (entry?.selector) {
    return entry.selector;
  }

  if (entry && slug.startsWith(SECTION_PREFIX)) {
    return `.fwp-${slug.slice(SECTION_PREFIX.length)}`;
  }

  const available = Object.keys(nodes).filter(
    (key) => nodes[key]?.selector || key.startsWith(SECTION_PREFIX)
  );

  throw new Error(
    `Nieznany slug "${slug}" — brak pola "selector" w nodes.json i brak przedrostka ` +
      `"${SECTION_PREFIX}" pozwalającego wyprowadzić selektor. ` +
      `Dostępne: ${available.join(', ') || '(nodes.json nie ma jeszcze żadnej sekcji)'}.`
  );
}

/**
 * Rozstrzyga, co zrobić z danym slugiem i breakpointem, zanim otworzymy przeglądarkę:
 *
 *  - `porownaj`: jest węzeł w Figmie — pełne porównanie;
 *  - `obecnosc`: brak makiety mobilnej (`"mobile": null`). To normalny przypadek —
 *    wersja mobilna jest wtedy projektowana w kodzie, nie w Figmie — więc nie ma
 *    czego porównywać i nie jest to błąd. Nadal jednak sprawdzamy, że sekcja
 *    istnieje na stronie: komenda, która przechodzi przy braku sekcji, nic
 *    nie weryfikuje.
 *
 * Brak węzła desktopowego to błąd konfiguracji — rzuca wyjątkiem.
 */
/**
 * Adres strony, na której leży sekcja: baza (urlLokalny) + pole "path" wpisu
 * w nodes.json. Brak pola = strona główna.
 */
export function pageUrl(base, entry) {
  const path = entry?.path;
  if (!path) {
    return base;
  }
  return `${String(base).replace(/\/+$/, '')}/${String(path).replace(/^\/+/, '')}`;
}

export function planRun(slug, breakpoint, nodes) {
  const selector = sectionSelector(slug, nodes);
  const nodeId = nodes[slug]?.[breakpoint];

  if (nodeId) {
    return { action: 'porownaj', selector, nodeId };
  }

  if (breakpoint === 'mobile') {
    return {
      action: 'obecnosc',
      selector,
      message:
        `${slug}: brak makiety mobilnej — wersja mobilna jest projektowana, ` +
        'porównanie pominięte, weryfikuj zrzutem.',
    };
  }

  throw new Error(
    `Slug "${slug}" nie ma węzła desktopowego w docs/figma/nodes.json — uzupełnij pole "desktop".`
  );
}

/**
 * Rozstrzyga wynik porównania na kod wyjścia i komunikat: rozjazd wymiarów albo
 * różnica pikseli powyżej 2% to blocker (kod 1); poniżej progu to sukces (kod 0).
 * Progi są ustaleniem projektowym i celowo nie są parametryzowane.
 *
 * `geometryProblems` (wynik assertGeometry()) przewraca wynik niezależnie od
 * różnicy pikseli — maskowanie tekstu zdejmuje piksele z porównania, więc
 * musi istnieć ścieżka, której nie da się oszukać zerową różnicą w zamaskowanym
 * obszarze.
 */
export function decideOutcome(compareResult, geometryProblems = []) {
  if (compareResult.sizeMismatch) {
    return { exitCode: 1, message: compareResult.message };
  }

  if (geometryProblems.length > 0) {
    return {
      exitCode: 1,
      message: `Geometria poza tolerancją: ${geometryProblems.join(' ')}`,
    };
  }

  const percent = (compareResult.diffRatio * 100).toFixed(2);
  const hotspots = compareResult.hotspots ?? [];

  if (hotspots.length > 0) {
    const list = hotspots
      .slice(0, 5)
      .map((h) => `(${h.x}, ${h.y}) ${Math.round(h.ratio * 100)}%`)
      .join('; ');
    return {
      exitCode: 1,
      message:
        `Różnica pikseli ${percent}%, ale ${hotspots.length} skupisk(a) różnic w kafelkach ` +
        `${HOTSPOT_TILE_PX} px (lewy górny róg w px sekcji, udział różnych pikseli): ${list}. ` +
        'Obejrzyj plik .diff.png w tych miejscach.',
    };
  }

  if (compareResult.diffRatio > DIFF_RATIO_THRESHOLD) {
    return {
      exitCode: 1,
      message: `Różnica pikseli ${percent}% przekracza próg ${DIFF_RATIO_THRESHOLD * 100}%.`,
    };
  }

  return {
    exitCode: 0,
    message: `OK — różnica pikseli ${percent}% (próg ${DIFF_RATIO_THRESHOLD * 100}%).`,
  };
}

export function parseArgs(argv) {
  const positional = argv.filter((arg) => !arg.startsWith('-'));
  return {
    slug: positional[0] ?? null,
    breakpoint: argv.includes('--mobile') ? 'mobile' : 'desktop',
    help: argv.includes('--help') || argv.includes('-h'),
  };
}

export const HELP = `Porównuje render sekcji z eksportem jej węzła z Figmy.

Użycie: npm run parity -- <slug> [--mobile]

  <slug>     klucz z docs/figma/nodes.json, np. home-hero
             (selektor: jawne pole "selector" albo home-<nazwa> -> .fwp-<nazwa>)
  --mobile   węzeł mobilny; viewport ma szerokość ramki z projekt.json
             (figma.ramki.mobile / .desktop, zapasowo szerokosciTestowe)

Brakująca referencja jest pobierana z Figmy automatycznie (FIGMA_TOKEN w .env).
Kod wyjścia 1: sekcji nie ma na stronie, rozjazd wymiarów, geometria > 4 px
albo różnica pikseli > 2% poza maskami tekstu.
Wpis z "mobile": null + --mobile: sprawdza tylko obecność sekcji i zapisuje zrzut.`;

/**
 * Zbiera prostokąty linii tekstu wewnątrz badanej sekcji, w pikselach CSS
 * względem viewportu.
 *
 * Używa Range.getClientRects() na węzłach tekstowych, nie getBoundingClientRect()
 * na elementach: to pierwsze daje rzeczywiste prostokąty linii (zawinięty tekst
 * to więcej niż jeden prostokąt), drugie dałoby jeden prostokąt na cały blok,
 * łącznie z pustym miejscem z paddingu czy interlinii — maska zjadłaby wtedy
 * obszary, które powinny być porównywane.
 */
async function collectTextClientRects(page, selector) {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) {
      return [];
    }

    const rects = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || node.nodeValue.trim().length === 0) {
          return NodeFilter.FILTER_REJECT;
        }
        const parentTag = node.parentElement ? node.parentElement.tagName : '';
        if (parentTag === 'SCRIPT' || parentTag === 'STYLE' || parentTag === 'TEMPLATE') {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    let node = walker.nextNode();
    while (node) {
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.width > 0 && rect.height > 0) {
          rects.push({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
        }
      }
      node = walker.nextNode();
    }

    return rects;
  }, selector);
}

async function defaultOpenPage(viewport) {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  // reducedMotion: sekcje z animacją wejścia (kaskady, liczniki, zoom zdjęcia)
  // pokazują wtedy stan końcowy — ten, który rysuje makieta. Bez tego zrzut
  // łapie animację w połowie i porównanie mierzy moment, nie wygląd.
  const page = await browser.newPage({ viewport, deviceScaleFactor: DEVICE_SCALE_FACTOR, reducedMotion: 'reduce' });
  return { page, close: () => browser.close() };
}

async function defaultEnsureReference(slug, breakpoint, nodes, projekt) {
  const path = refPath(slug, breakpoint);
  if (existsSync(path)) {
    return path;
  }
  return downloadReference({
    slug,
    breakpoint,
    nodes,
    fileKey: requireFileKey(projekt),
    token: resolveToken(),
    projekt,
  });
}

/**
 * Przebieg porównania. Zależności od świata zewnętrznego (projekt.json,
 * nodes.json, przeglądarka, pobieranie referencji, wyjście) są wstrzykiwane,
 * żeby ścieżki decydujące o kodzie wyjścia dało się przetestować bez
 * przeglądarki i bez WordPressa. Zwraca kod wyjścia.
 */
export async function runParity(argv, deps = {}) {
  const log = deps.log ?? console.log;
  const warn = deps.warn ?? console.warn;
  const error = deps.error ?? console.error;
  const openPage = deps.openPage ?? defaultOpenPage;
  const ensureReference = deps.ensureReference ?? defaultEnsureReference;

  const { slug, breakpoint, help } = parseArgs(argv);
  if (help || !slug) {
    log(HELP);
    return help ? 0 : 1;
  }

  const projekt = deps.projekt ?? readProjekt();
  const nodes = deps.nodes ?? readNodes();

  let plan;
  try {
    plan = planRun(slug, breakpoint, nodes);
  } catch (planError) {
    error(planError.message);
    return 1;
  }

  const { selector } = plan;
  const url = pageUrl(baseUrl(projekt), nodes[slug]);

  // Referencję pobieramy przed otwarciem przeglądarki — błąd tokenu albo API
  // ma się pojawić od razu, a nie po starcie Chromium.
  const refFile = plan.action === 'porownaj' ? await ensureReference(slug, breakpoint, nodes, projekt) : null;

  // Pierwsze pobranie referencji mogło uzupełnić figma.ramki w projekt.json,
  // więc szerokość viewportu czytamy dopiero teraz.
  const projektPo = deps.projekt ?? readProjekt();
  const viewport = viewportPorownania(projektPo, breakpoint, warn);

  const { page, close } = await openPage(viewport);
  try {
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);

    const element = page.locator(selector);
    if ((await element.count()) === 0) {
      error(`Selektor "${selector}" nie występuje na stronie ${url} — sekcja jeszcze nie istnieje.`);
      return 1;
    }

    // Elementy przyklejone do ekranu (pasek uwag Agentation, FAB, sticky nagłówek)
    // nakładają się na zrzut sekcji, której nie należą — bez tego każda sekcja
    // pod FAB-em miałaby fałszywe skupisko różnic. Ukrywamy je przez visibility,
    // żeby nie zmienić układu. Elementów wewnątrz badanej sekcji (i jej samej) nie ruszamy.
    await page.evaluate((sel) => {
      const target = document.querySelector(sel);
      for (const el of document.body.querySelectorAll('*')) {
        const { position } = getComputedStyle(el);
        if ((position === 'fixed' || position === 'sticky') && !el.contains(target) && !target?.contains(el)) {
          el.style.visibility = 'hidden';
        }
      }
    }, selector);

    // scroll-padding-top motywu (offset kotwic pod przyklejonym nagłówkiem) przesuwa
    // przewinięcie przy zrzucie elementu i zrzut łapie pas następnej sekcji.
    await page.evaluate(() => {
      document.documentElement.style.scrollPaddingTop = '0px';
    });

    // Obrazy z loading="lazy" poniżej ekranu nie wczytują się przed zrzutem
    // wysokiej sekcji — zrzut pokazałby puste ramki zamiast zdjęć.
    // decode() na obrazie jeszcze niepobranym od razu odrzuca obietnicę, więc
    // czekamy na zdarzenie load (z limitem, żeby zepsuty obraz nie wieszał porównania).
    await page.evaluate(async () => {
      const images = [...document.images];
      for (const img of images) img.loading = 'eager';
      // Po load czekamy jeszcze na decode(): obraz z decoding="async" bywa
      // pobrany, ale niezamalowany w chwili zrzutu.
      await Promise.all(
        images.map((img) =>
          (img.complete && img.naturalWidth
            ? Promise.resolve()
            : new Promise((resolve) => {
                img.addEventListener('load', resolve, { once: true });
                img.addEventListener('error', resolve, { once: true });
                setTimeout(resolve, 10000);
              })
          ).then(() => (img.naturalWidth ? img.decode().catch(() => {}) : null))
        )
      );
    });

    // Zrzut na stałym stanie scrolla, żeby prostokąty zmierzone zaraz potem
    // (boundingBox(), collectTextClientRects()) opisywały dokładnie to, co
    // zostało sfotografowane, a nie stan sprzed doscrollowania elementu.
    await element.first().scrollIntoViewIfNeeded();

    if (plan.action === 'obecnosc') {
      const shotPath = refPath(slug, breakpoint).replace(/\.png$/, '.actual.png');
      mkdirSync(dirname(shotPath), { recursive: true });
      await element.first().screenshot({ path: shotPath });
      log(plan.message);
      log(`Sekcja "${selector}" jest na stronie. Zrzut do obejrzenia: ${shotPath}`);
      return 0;
    }

    const actualBuffer = await element.first().screenshot({ animations: 'disabled' });
    const sectionBox = await element.first().boundingBox();
    if (!sectionBox) {
      error(`Nie udało się zmierzyć ramki elementu "${selector}" — czy nie jest ukryty na tej szerokości?`);
      return 1;
    }

    const rawRefBuffer = readFileSync(refFile);

    // 1. Przycięcie referencji do ramki węzła. Prostokąt jest zapisany w nodes.json
    //    (pole "crop", wyliczane automatycznie przy pobieraniu referencji), żeby nie
    //    pobierać pełnego drzewa węzła z API przy każdym uruchomieniu. Brak pola
    //    oznacza, że eksport ma wymiary ramki.
    const crop = nodes[slug]?.crop?.[breakpoint];
    const croppedRefBuffer = crop ? cropPng(rawRefBuffer, crop) : rawRefBuffer;
    if (crop) {
      // Duży nadmiar oznacza, że w makiecie coś wystaje poza ramkę — warto to
      // zgłosić projektantowi, bo może to być niezamierzone.
      const original = PNG.sync.read(rawRefBuffer);
      log(
        `Przycięto referencję ${slug}.${breakpoint}: eksport ${original.width}x${original.height} ` +
          `-> ramka węzła ${crop.width}x${crop.height} ` +
          `(obcięto lewo ${crop.x}px, góra ${crop.y}px, ` +
          `prawo ${original.width - crop.width - crop.x}px, dół ${original.height - crop.height - crop.y}px).`
      );
    }

    // 2. Przycięcie ZRZUTU do warstwy treści, którą mierzy węzeł z Figmy.
    const areaConfig = areaConfigFor(slug, nodes, breakpoint);
    let croppedActualBuffer = actualBuffer;
    let area = null;

    if (areaConfig) {
      const areaLocator = element.first().locator(areaConfig.selector).first();
      const areaBox = (await areaLocator.count()) > 0 ? await areaLocator.boundingBox() : null;
      const refWidthPx = PNG.sync.read(croppedRefBuffer).width;

      area = resolveHorizontalArea(
        areaBox ? { x: areaBox.x, width: areaBox.width } : null,
        refWidthPx,
        viewport.width
      );

      const rawActualPng = PNG.sync.read(actualBuffer);
      const cropRect = areaToCropRect(area, sectionBox, rawActualPng.width, rawActualPng.height, DEVICE_SCALE_FACTOR);
      croppedActualBuffer = cropPng(actualBuffer, cropRect);

      log(
        `Przycięto zrzut ${slug}.${breakpoint} do obszaru "${areaConfig.selector}": ` +
          `${rawActualPng.width}x${rawActualPng.height} -> ${cropRect.width}x${cropRect.height} ` +
          `(start x=${cropRect.x}px).` +
          (area.usedFallback
            ? ` UŻYTO WARIANTU ZAPASOWEGO: sekcja nie zawiera elementu "${areaConfig.selector}" ` +
              '— wyśrodkowano wg szerokości referencji.'
            : '')
      );
    }

    // 3. Spłaszczenie referencji na tło, na którym element faktycznie się renderuje —
    //    na kopii w pamięci, plik na dysku zostaje nietkniętym eksportem z Figmy.
    const background = await resolveBackgroundColor(element.first());
    const flattenedRefBuffer = flattenOnBackground(croppedRefBuffer, background);

    // 4. Maski tekstu: prostokąty linii z DOM, przeliczone na współrzędne obszaru
    //    porównania, rozszerzone o margines i scalone. Te same prostokąty nakładamy
    //    na obie strony — inaczej sama maska tworzyłaby różnicę.
    const clientRects = await collectTextClientRects(page, selector);
    const maskOrigin = resolveMaskOrigin(area, sectionBox);
    const maskRects = mergeOverlappingRects(
      clientRects.map((rect) => toMaskRect(rect, maskOrigin, MARGIN_CSS_PX, DEVICE_SCALE_FACTOR))
    );

    const refPng = PNG.sync.read(flattenedRefBuffer);
    const actualPng = PNG.sync.read(croppedActualBuffer);
    applyMasks(refPng, maskRects);
    applyMasks(actualPng, maskRects);
    const maskedRefBuffer = PNG.sync.write(refPng);
    const maskedActualBuffer = PNG.sync.write(actualPng);

    const coverage = maskCoverageRatio(maskRects, refPng.width, refPng.height);
    log(`Maski tekstu: ${maskRects.length} prostokątów, pokrycie ${(coverage * 100).toFixed(1)}% powierzchni sekcji.`);
    if (isCoverageExcessive(coverage)) {
      warn(
        `OSTRZEŻENIE: maska pokrywa ${(coverage * 100).toFixed(1)}% sekcji — powyżej progu ` +
          `${MASK_COVERAGE_WARNING_RATIO * 100}%, porównanie pikselowe traci sens.`
      );
    }

    const result = comparePng(maskedRefBuffer, maskedActualBuffer);
    result.hotspots = result.sizeMismatch ? [] : findHotspots(result.diff);

    // Geometria sekcji jako całości, niezależna od maskowania: wymiary referencji
    // kontra realna ramka elementu zmierzona w DOM. To ścieżka, której zerowa
    // różnica pikseli w zamaskowanym obszarze nie potrafi oszukać.
    const geometryProblems = assertGeometry(
      [{ name: slug, x: 0, y: 0, width: refPng.width, height: refPng.height }],
      [
        {
          name: slug,
          x: 0,
          y: 0,
          // Z konfiguracją "area" porównujemy przycięty zrzut, więc jego szerokość
          // to szerokość warstwy treści, nie całej sekcji.
          width: area ? actualPng.width : Math.round(sectionBox.width * DEVICE_SCALE_FACTOR),
          height: Math.round(sectionBox.height * DEVICE_SCALE_FACTOR),
        },
      ],
      GEOMETRY_TOLERANCE_PX
    );

    const outcome = decideOutcome(result, geometryProblems);

    if (!result.sizeMismatch) {
      writeFileSync(refFile.replace(/\.png$/, '.diff.png'), result.diff);
    }

    if (outcome.exitCode !== 0) {
      // Spłaszczona referencja, obie strony po maskowaniu i obraz różnicy razem —
      // bez nich nie da się obejrzeć, co właściwie porównywano (surowa referencja
      // ma przezroczystość, której na diffie i tak nie widać).
      writeFileSync(refFile.replace(/\.png$/, '.flattened.png'), flattenedRefBuffer);
      writeFileSync(refFile.replace(/\.png$/, '.masked-reference.png'), maskedRefBuffer);
      writeFileSync(refFile.replace(/\.png$/, '.masked-actual.png'), maskedActualBuffer);
      const kinds = result.sizeMismatch
        ? 'flattened,masked-reference,masked-actual'
        : 'diff,flattened,masked-reference,masked-actual';
      log(`Obrazy do obejrzenia: ${refFile.replace(/\.png$/, `.{${kinds}}.png`)}`);
    }

    (outcome.exitCode === 0 ? log : error)(outcome.message);
    return outcome.exitCode;
  } finally {
    await close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runParity(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error(err.message);
      process.exitCode = 1;
    });
}
