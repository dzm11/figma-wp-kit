import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import {
  applyMasks,
  comparePng,
  assertGeometry,
  sectionSelector,
  decideOutcome,
  flattenOnBackground,
  parseRgbColor,
  toMaskRect,
  mergeOverlappingRects,
  maskCoverageRatio,
  isCoverageExcessive,
  sumVisibleBoundingBoxes,
  computeCropOffset,
  cropPng,
  areaConfigFor,
  resolveHorizontalArea,
  areaToCropRect,
  resolveMaskOrigin,
  planRun,
  parseArgs,
  runParity,
} from './parity.mjs';

function solid(width, height, [r, g, b]) {
  const png = new PNG({ width, height });
  for (let i = 0; i < width * height; i++) {
    png.data[i * 4] = r;
    png.data[i * 4 + 1] = g;
    png.data[i * 4 + 2] = b;
    png.data[i * 4 + 3] = 255;
  }
  return png;
}

const buf = (png) => PNG.sync.write(png);

function pixel([r, g, b, a]) {
  const png = new PNG({ width: 1, height: 1 });
  png.data[0] = r;
  png.data[1] = g;
  png.data[2] = b;
  png.data[3] = a;
  return buf(png);
}

test('identyczne obrazy dają zerową różnicę', () => {
  const a = buf(solid(10, 10, [255, 255, 255]));
  const result = comparePng(a, a);
  assert.equal(result.diffPixels, 0);
  assert.equal(result.diffRatio, 0);
  assert.equal(result.sizeMismatch, false);
});

test('całkowicie różne obrazy dają różnicę równą jedności', () => {
  const white = buf(solid(10, 10, [255, 255, 255]));
  const black = buf(solid(10, 10, [0, 0, 0]));
  const result = comparePng(white, black);
  assert.equal(result.diffRatio, 1);
});

test('różnica wymiarów jest raportowana, a nie wyciszana', () => {
  const small = buf(solid(10, 10, [255, 255, 255]));
  const large = buf(solid(20, 10, [255, 255, 255]));
  const result = comparePng(small, large);
  assert.equal(result.sizeMismatch, true);
});

test('maska zeruje różnicę w zamaskowanym obszarze', () => {
  const white = solid(10, 10, [255, 255, 255]);
  const patched = solid(10, 10, [255, 255, 255]);
  patched.data[0] = 0;
  patched.data[1] = 0;
  patched.data[2] = 0;

  const masks = [{ x: 0, y: 0, width: 2, height: 2 }];
  const result = comparePng(buf(applyMasks(white, masks)), buf(applyMasks(patched, masks)));
  assert.equal(result.diffPixels, 0);
});

test('applyMasks nie rusza pikseli poza prostokątem', () => {
  const png = applyMasks(solid(4, 1, [10, 20, 30]), [{ x: 0, y: 0, width: 1, height: 1 }]);
  assert.notDeepEqual([png.data[0], png.data[1], png.data[2]], [10, 20, 30]);
  assert.deepEqual([png.data[4], png.data[5], png.data[6]], [10, 20, 30]);
});

test('assertGeometry milczy, gdy wszystko mieści się w tolerancji', () => {
  const expected = [{ name: 'h1', x: 0, y: 0, width: 100, height: 40 }];
  const actual = [{ name: 'h1', x: 2, y: 1, width: 103, height: 40 }];
  assert.deepEqual(assertGeometry(expected, actual, 4), []);
});

test('assertGeometry wskazuje konkretną właściwość i wartości', () => {
  const expected = [{ name: 'h1', x: 0, y: 0, width: 100, height: 40 }];
  const actual = [{ name: 'h1', x: 0, y: 0, width: 120, height: 40 }];
  const problems = assertGeometry(expected, actual, 4);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /h1/);
  assert.match(problems[0], /width/);
  assert.match(problems[0], /100/);
  assert.match(problems[0], /120/);
});

test('assertGeometry zgłasza element obecny w Figmie, a nieobecny w renderze', () => {
  const problems = assertGeometry([{ name: 'cta', x: 0, y: 0, width: 10, height: 10 }], [], 4);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /brak/i);
});

test('sectionSelector wyprowadza selektor CSS z nazwy sekcji home-*', () => {
  const nodes = {
    'home-hero': { desktop: '1:1', mobile: '1:2' },
    'home-projects': { desktop: '1:3', mobile: '1:4' },
  };
  assert.equal(sectionSelector('home-hero', nodes), '.fwp-hero');
  assert.equal(sectionSelector('home-projects', nodes), '.fwp-projects');
});

test('sectionSelector używa jawnego pola "selector", gdy slug nie pasuje do konwencji home-*', () => {
  // Komponenty obramowania strony (header/footer/pasek ogłoszeń) nie mają
  // przedrostka "home-", więc nie da się dla nich wyprowadzić selektora z nazwy —
  // nodes.json podaje go wprost.
  const nodes = {
    'site-header': { desktop: '1:10', mobile: '1:11', selector: '.fwp-header' },
    'site-footer': { desktop: '1:20', mobile: '1:21', selector: '.fwp-footer' },
    'announcement-bar': { desktop: '1:30', mobile: null, selector: '.fwp-announcement' },
  };
  assert.equal(sectionSelector('site-header', nodes), '.fwp-header');
  assert.equal(sectionSelector('site-footer', nodes), '.fwp-footer');
  assert.equal(sectionSelector('announcement-bar', nodes), '.fwp-announcement');
});

test('sectionSelector rzuca czytelny błąd i wymienia dostępne slugi', () => {
  const nodes = {
    'home-hero': { desktop: '1:1', mobile: '1:2' },
    'home-projects': { desktop: '1:3', mobile: '1:4' },
    'site-header': { desktop: '1:10', mobile: '1:11', selector: '.fwp-header' },
  };
  assert.throws(() => sectionSelector('home-nope', nodes), (error) => {
    assert.match(error.message, /home-nope/);
    assert.match(error.message, /home-hero/);
    assert.match(error.message, /home-projects/);
    assert.match(error.message, /site-header/);
    return true;
  });
});

test('sectionSelector rzuca czytelny błąd dla sluga bez pola "selector" i bez przedrostka home-', () => {
  // Np. literówka albo slug pomocniczy (jak "_page"), który nie jest ani
  // sekcją home-*, ani komponentem z jawnym selektorem.
  const nodes = {
    'home-hero': { desktop: '1:1', mobile: '1:2' },
    _page: { desktop: '1:1', mobile: '1:2' },
  };
  assert.throws(() => sectionSelector('_page', nodes), (error) => {
    assert.match(error.message, /_page/);
    return true;
  });
});

test('decideOutcome kończy kodem 1 przy rozjeździe wymiarów', () => {
  const outcome = decideOutcome({ sizeMismatch: true, message: 'Rozjazd wymiarów: Figma 100x100, przeglądarka 90x100.' });
  assert.equal(outcome.exitCode, 1);
  assert.match(outcome.message, /Rozjazd wymiarów/);
});

test('decideOutcome kończy kodem 1, gdy różnica pikseli przekracza próg 2%', () => {
  const outcome = decideOutcome({ sizeMismatch: false, diffRatio: 0.03 });
  assert.equal(outcome.exitCode, 1);
  assert.match(outcome.message, /3\.00%/);
});

test('decideOutcome kończy kodem 0, gdy różnica pikseli mieści się w progu 2%', () => {
  const outcome = decideOutcome({ sizeMismatch: false, diffRatio: 0.001 });
  assert.equal(outcome.exitCode, 0);
  assert.match(outcome.message, /0\.10%/);
});

test('decideOutcome traktuje dokładnie 2% jako mieszczące się w progu', () => {
  const outcome = decideOutcome({ sizeMismatch: false, diffRatio: 0.02 });
  assert.equal(outcome.exitCode, 0);
});

// Referencje eksportowane z Figmy bez własnego tła mają
// kanał alfa (przezroczyste), a zrzut z przeglądarki jest zawsze nieprzezroczysty
// (renderuje się na tle strony). Porównanie musi więc spłaszczyć referencję na
// to samo tło przed porównaniem pikseli — inaczej "różnica" to tylko dziura
// kontra brak dziury, niezależnie od tego, co faktycznie narysowano.

test('flattenOnBackground: piksel w pełni przezroczysty przyjmuje kolor tła', () => {
  const input = pixel([10, 20, 30, 0]);
  const out = PNG.sync.read(flattenOnBackground(input, [200, 150, 100]));
  assert.deepEqual(Array.from(out.data), [200, 150, 100, 255]);
});

test('flattenOnBackground: piksel w pełni nieprzezroczysty zostaje bez zmian', () => {
  const input = pixel([10, 20, 30, 255]);
  const out = PNG.sync.read(flattenOnBackground(input, [200, 150, 100]));
  assert.deepEqual(Array.from(out.data), [10, 20, 30, 255]);
});

test('flattenOnBackground: piksel półprzezroczysty daje wynik pośredni (kompozycja "over")', () => {
  // alfa 128/255 ≈ 0.502; wynik = 0*alfa + 255*(1-alfa) ≈ 126.75 -> 127 po zaokrągleniu
  const input = pixel([0, 0, 0, 128]);
  const out = PNG.sync.read(flattenOnBackground(input, [255, 255, 255]));
  assert.equal(out.data[0], 127);
  assert.equal(out.data[1], 127);
  assert.equal(out.data[2], 127);
  assert.equal(out.data[3], 255);
});

test('flattenOnBackground nie mutuje bufora wejściowego (referencja na dysku ma zostać nietknięta)', () => {
  const input = pixel([10, 20, 30, 0]);
  const inputCopy = Buffer.from(input);
  flattenOnBackground(input, [200, 150, 100]);
  assert.deepEqual(input, inputCopy);
});

test('parseRgbColor odczytuje rgb() jako w pełni nieprzezroczysty', () => {
  assert.deepEqual(parseRgbColor('rgb(10, 20, 30)'), { r: 10, g: 20, b: 30, a: 1 });
});

test('parseRgbColor odczytuje rgba() wraz z kanałem alfa', () => {
  assert.deepEqual(parseRgbColor('rgba(10, 20, 30, 0.5)'), { r: 10, g: 20, b: 30, a: 0.5 });
});

test('parseRgbColor zwraca null dla nierozpoznanej wartości', () => {
  assert.equal(parseRgbColor('nonsense'), null);
  assert.equal(parseRgbColor(''), null);
  assert.equal(parseRgbColor(undefined), null);
});

// Porównanie pikselowe bez masek liczyłoby antyaliasing liter, który nigdy nie
// będzie zgodny między rasteryzatorem Figmy a przeglądarką. Poniższe funkcje
// spinają maski z CLI:
// przeliczenie współrzędnych DOM na współrzędne sekcji, rozszerzenie o margines,
// scalanie nachodzących prostokątów i liczenie pokrycia.

test('toMaskRect: bez marginesu i skali tylko odejmuje początek sekcji', () => {
  const rect = toMaskRect({ x: 110, y: 50, width: 20, height: 10 }, { x: 100, y: 40 }, 0, 1);
  assert.deepEqual(rect, { x: 10, y: 10, width: 20, height: 10 });
});

test('toMaskRect: margines rozszerza prostokąt o podaną wartość z każdej strony', () => {
  const rect = toMaskRect({ x: 100, y: 100, width: 20, height: 10 }, { x: 0, y: 0 }, 2, 1);
  assert.deepEqual(rect, { x: 98, y: 98, width: 24, height: 14 });
});

test('toMaskRect: skala mnoży pozycję i wymiary dopiero po odjęciu początku i dodaniu marginesu', () => {
  // deviceScaleFactor 2: zrzut ma dwa razy więcej pikseli niż CSS, więc maska
  // musi być przeliczona na tę samą skalę, inaczej wyląduje w złym miejscu.
  const rect = toMaskRect({ x: 10, y: 10, width: 10, height: 5 }, { x: 0, y: 0 }, 0, 2);
  assert.deepEqual(rect, { x: 20, y: 20, width: 20, height: 10 });
});

test('mergeOverlappingRects: dwa nachodzące się prostokąty scalają się w jeden', () => {
  const merged = mergeOverlappingRects([
    { x: 0, y: 0, width: 10, height: 10 },
    { x: 5, y: 5, width: 10, height: 10 },
  ]);
  assert.deepEqual(merged, [{ x: 0, y: 0, width: 15, height: 15 }]);
});

test('mergeOverlappingRects: rozłączne prostokąty zostają osobno', () => {
  const rects = [
    { x: 0, y: 0, width: 5, height: 5 },
    { x: 100, y: 100, width: 5, height: 5 },
  ];
  const merged = mergeOverlappingRects(rects);
  assert.equal(merged.length, 2);
});

test('mergeOverlappingRects: scalanie jest przechodnie (A~B, B~C, ale nie A~C wprost)', () => {
  const merged = mergeOverlappingRects([
    { x: 0, y: 0, width: 6, height: 10 },
    { x: 5, y: 0, width: 6, height: 10 },
    { x: 10, y: 0, width: 6, height: 10 },
  ]);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0], { x: 0, y: 0, width: 16, height: 10 });
});

test('maskCoverageRatio: pojedynczy prostokąt pokrywający połowę powierzchni', () => {
  const ratio = maskCoverageRatio([{ x: 0, y: 0, width: 5, height: 10 }], 10, 10);
  assert.equal(ratio, 0.5);
});

test('maskCoverageRatio: nachodzące się prostokąty nie liczą się podwójnie', () => {
  const ratio = maskCoverageRatio(
    [
      { x: 0, y: 0, width: 6, height: 10 },
      { x: 4, y: 0, width: 6, height: 10 },
    ],
    10,
    10
  );
  // Suma pól dałaby 120% (12 kolumn z 10), ale realne pokrycie to cała szerokość — 100%.
  assert.equal(ratio, 1);
});

test('maskCoverageRatio: prostokąt wychodzący poza sekcję jest przycinany, nie zawyża wyniku', () => {
  const ratio = maskCoverageRatio([{ x: -5, y: -5, width: 10, height: 10 }], 10, 10);
  assert.equal(ratio, 0.25);
});

test('maskCoverageRatio: brak prostokątów daje zerowe pokrycie', () => {
  assert.equal(maskCoverageRatio([], 10, 10), 0);
});

test('isCoverageExcessive: dokładnie próg 40% jeszcze nie jest nadmiarem', () => {
  assert.equal(isCoverageExcessive(0.4, 0.4), false);
});

test('isCoverageExcessive: powyżej 40% to nadmiar', () => {
  assert.equal(isCoverageExcessive(0.41, 0.4), true);
});

test('isCoverageExcessive: niskie pokrycie to nie nadmiar', () => {
  assert.equal(isCoverageExcessive(0.05, 0.4), false);
});

// decideOutcome musi przewrócić wynik przy niepowodzeniu geometrii, nawet gdy
// porównanie pikselowe (po zamaskowaniu tekstu) wyszło idealnie na zero —
// dokładnie ten scenariusz, w którym maska ukryłaby przesunięcie tekstu.

test('decideOutcome: niepowodzenie geometrii przewraca wynik mimo zerowej różnicy pikseli', () => {
  const outcome = decideOutcome({ sizeMismatch: false, diffRatio: 0 }, ['"h1" x: rozjazd 10.0 px']);
  assert.equal(outcome.exitCode, 1);
  assert.match(outcome.message, /h1/);
});

test('decideOutcome: pusta lista problemów geometrii nie wpływa na ocenę pikseli', () => {
  const outcome = decideOutcome({ sizeMismatch: false, diffRatio: 0.001 }, []);
  assert.equal(outcome.exitCode, 0);
});

test('decideOutcome: rozjazd wymiarów ma pierwszeństwo przed problemami geometrii', () => {
  const outcome = decideOutcome(
    { sizeMismatch: true, message: 'Rozjazd wymiarów: Figma 100x100, przeglądarka 90x100.' },
    ['jakiś problem geometrii']
  );
  assert.match(outcome.message, /Rozjazd wymiarów/);
});

// Eksport PNG z Figmy nie ma wymiarów węzła, gdy jakieś
// dziecko wystaje poza jego ramkę — Figma renderuje całą "farbę" poddrzewa.
// sumVisibleBoundingBoxes/computeCropOffset/cropPng odtwarzają rzeczywisty
// prostokąt eksportu i przycinają go z powrotem do ramki węzła, przed
// spłaszczaniem i maskowaniem. Liczby w testach „stopki” pochodzą z rzeczywistych
// pomiarów (bbox z REST API kontra wymiary PNG na dysku).

test('sumVisibleBoundingBoxes: węzeł bez dzieci daje sumę równą własnemu bboxowi (nagłówek — zerowy nadmiar)', () => {
  const node = { absoluteBoundingBox: { x: 50, y: 1322, width: 1820, height: 184 }, children: [] };
  assert.deepEqual(sumVisibleBoundingBoxes(node), { x: 50, y: 1322, width: 1820, height: 184 });
});

test('sumVisibleBoundingBoxes: dziecko wystające w dół i w prawo powiększa sumę (stopka desktop)', () => {
  // Odtworzenie przypadku "Grid lines": grupa dekoracyjna 1599x1099 wewnątrz
  // stopki 1820x1024 — węzeł jest wyższy od rodzica o 75 px.
  const node = {
    absoluteBoundingBox: { x: 50, y: 11663, width: 1820, height: 1024 },
    children: [{ absoluteBoundingBox: { x: 50, y: 11663, width: 1599, height: 1099 } }],
  };
  assert.deepEqual(sumVisibleBoundingBoxes(node), { x: 50, y: 11663, width: 1820, height: 1099 });
});

test('sumVisibleBoundingBoxes: dziecko wystające w prawo przy sztywnej szerokości (stopka mobile)', () => {
  // Odtworzenie przypadku "Credits": blok 728 px szeroki przy kontenerze 393 px,
  // przesunięty o 16 px od lewej -> wystaje do x=744.
  const node = {
    absoluteBoundingBox: { x: 0, y: 24393, width: 393, height: 1391 },
    children: [{ absoluteBoundingBox: { x: 16, y: 24393 + 1000, width: 728, height: 40 } }],
  };
  assert.deepEqual(sumVisibleBoundingBoxes(node), { x: 0, y: 24393, width: 744, height: 1391 });
});

test('sumVisibleBoundingBoxes: nadmiar może wystawać też z lewej i z góry', () => {
  const node = {
    absoluteBoundingBox: { x: 100, y: 100, width: 50, height: 50 },
    children: [{ absoluteBoundingBox: { x: 80, y: 90, width: 20, height: 20 } }],
  };
  // Węzeł: 100..150 x 100..150. Dziecko: 80..100 x 90..110.
  // Suma: 80..150 x 90..150 -> {x:80, y:90, width:70, height:60}.
  assert.deepEqual(sumVisibleBoundingBoxes(node), { x: 80, y: 90, width: 70, height: 60 });
});

test('sumVisibleBoundingBoxes: pomija całe poddrzewo węzła niewidocznego', () => {
  const node = {
    absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
    children: [
      {
        visible: false,
        absoluteBoundingBox: { x: -500, y: -500, width: 10, height: 10 },
        children: [{ absoluteBoundingBox: { x: -1000, y: -1000, width: 10, height: 10 } }],
      },
    ],
  };
  assert.deepEqual(sumVisibleBoundingBoxes(node), { x: 0, y: 0, width: 100, height: 100 });
});

test('sumVisibleBoundingBoxes: nadmiar zagnieżdżony głębiej niż jeden poziom też się liczy', () => {
  const node = {
    absoluteBoundingBox: { x: 0, y: 0, width: 10, height: 10 },
    children: [
      {
        absoluteBoundingBox: { x: 0, y: 0, width: 10, height: 10 },
        children: [{ absoluteBoundingBox: { x: 0, y: 0, width: 30, height: 10 } }],
      },
    ],
  };
  assert.deepEqual(sumVisibleBoundingBoxes(node), { x: 0, y: 0, width: 30, height: 10 });
});

test('computeCropOffset: zerowy nadmiar daje przesunięcie (0, 0)', () => {
  const bbox = { x: 50, y: 1322, width: 1820, height: 184 };
  assert.deepEqual(computeCropOffset(bbox, bbox), { x: 0, y: 0 });
});

test('computeCropOffset: nadmiar tylko z prawej i z dołu nie przesuwa punktu startowego', () => {
  const bbox = { x: 50, y: 11663, width: 1820, height: 1024 };
  const union = { x: 50, y: 11663, width: 1820, height: 1099 };
  assert.deepEqual(computeCropOffset(bbox, union), { x: 0, y: 0 });
});

test('computeCropOffset: nadmiar z lewej i z góry przesuwa punkt startowy w głąb obrazu', () => {
  const bbox = { x: 100, y: 100, width: 50, height: 50 };
  const union = { x: 80, y: 90, width: 100, height: 100 };
  assert.deepEqual(computeCropOffset(bbox, union), { x: 20, y: 10 });
});

/**
 * Buduje PNG, w którym kolor piksela koduje jego współrzędne (r = x, g = y) —
 * pozwala to zweryfikować, że cropPng() wycina dokładnie właściwy fragment,
 * a nie tylko poprawny rozmiar.
 */
function coordinatePng(width, height) {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (width * y + x) << 2;
      png.data[i] = x % 256;
      png.data[i + 1] = y % 256;
      png.data[i + 2] = 0;
      png.data[i + 3] = 255;
    }
  }
  return buf(png);
}

test('cropPng: bez przesunięcia zwraca ten sam obraz co do piksela', () => {
  const source = coordinatePng(10, 10);
  const out = PNG.sync.read(cropPng(source, { x: 0, y: 0, width: 10, height: 10 }));
  assert.deepEqual(out.data, PNG.sync.read(source).data);
});

test('cropPng: wycina fragment zaczynający się w prawo i w dół od (0,0)', () => {
  const source = coordinatePng(20, 20);
  const out = PNG.sync.read(cropPng(source, { x: 5, y: 8, width: 4, height: 3 }));
  assert.equal(out.width, 4);
  assert.equal(out.height, 3);
  // Piksel (0,0) wyciętego obrazu ma odpowiadać pikselowi (5,8) źródła.
  assert.equal(out.data[0], 5);
  assert.equal(out.data[1], 8);
  // Piksel (3,2) wyciętego obrazu -> (8,10) źródła.
  const i = (4 * 2 + 3) << 2;
  assert.equal(out.data[i], 8);
  assert.equal(out.data[i + 1], 10);
});

test('cropPng: wycina fragment z nadmiarem wystającym z lewej i z góry (jak w stopce)', () => {
  // Symulacja stopki desktop: eksport 1820x1099, ramka węzła zaczyna się
  // w tym samym miejscu co eksport (offset 0,0), ale jest niższa — obcinamy dół.
  const source = coordinatePng(30, 30);
  const out = PNG.sync.read(cropPng(source, { x: 0, y: 0, width: 30, height: 20 }));
  assert.equal(out.height, 20);
  // Wiersz 20 (odcięty) nie ma prawa pojawić się w wyniku.
  assert.equal(out.data.length, 30 * 20 * 4);
});

// Węzeł Figmy mierzy warstwę treści (.fwp-wrapper 1820 albo
// .fwp-container 1480), a selektor sekcji w przeglądarce łapie pełnoekranowy
// <section> (viewport, np. 1920). Referencja jest już poprawnej szerokości
// (bbox węzła) — brakowało przycięcia ZRZUTU z przeglądarki do tej samej
// warstwy. areaConfigFor/resolveHorizontalArea/areaToCropRect/resolveMaskOrigin
// realizują to poniżej.

test('areaConfigFor: brak pola "area" na wpisie oznacza zachowanie dotychczasowe (null)', () => {
  const nodes = { 'site-header': { desktop: '1:10', selector: '.fwp-header' } };
  assert.equal(areaConfigFor('site-header', nodes), null);
});

test('areaConfigFor: brak sluga w ogóle też daje null, a nie wyjątek', () => {
  assert.equal(areaConfigFor('nieznany-slug', {}), null);
});

test('areaConfigFor: odczytuje jawnie zapisaną konfigurację obszaru', () => {
  const nodes = { 'home-video': { desktop: '1:40', area: { selector: '.fwp-wrapper' } } };
  assert.deepEqual(areaConfigFor('home-video', nodes), { selector: '.fwp-wrapper' });
});

test('resolveHorizontalArea: gdy element DOM znaleziony, używa jego realnego prostokąta', () => {
  // 1820 px wyśrodkowane w 1920 dałoby x=50 — ale tu chodzi o to, że funkcja
  // ma wziąć wprost zmierzony prostokąt, a nie go przeliczać ani niczego zgadywać.
  const area = resolveHorizontalArea({ x: 51, width: 1818 }, 1820, 1920);
  assert.deepEqual(area, { x: 51, width: 1818, usedFallback: false });
});

test('resolveHorizontalArea: wariant zapasowy centruje szerokość referencji w viewporcie', () => {
  // Brak elementu .fwp-wrapper/.fwp-container w DOM — policz z szerokości
  // węzła Figmy wyśrodkowanej w viewporcie i zaznacz to jako wariant zapasowy.
  const area = resolveHorizontalArea(null, 1820, 1920);
  assert.deepEqual(area, { x: 50, width: 1820, usedFallback: true });
});

test('resolveHorizontalArea: wariant zapasowy dla węzła .fwp-container 1480 w viewporcie 1920', () => {
  const area = resolveHorizontalArea(null, 1480, 1920);
  assert.deepEqual(area, { x: 220, width: 1480, usedFallback: true });
});

test('areaToCropRect: przelicza obszar viewportu na prostokąt przycięcia zrzutu sekcji', () => {
  // Sekcja pełnoekranowa zaczyna się w x=0 viewportu (sectionBox.x = 0),
  // obszar .fwp-wrapper zaczyna się w x=50 — zrzut trzeba przyciąć od piksela 50.
  const rect = areaToCropRect({ x: 50, width: 1820 }, { x: 0, y: 100 }, 1920, 720, 1);
  assert.deepEqual(rect, { x: 50, y: 0, width: 1820, height: 720 });
});

test('areaToCropRect: nie rusza wysokości — różnica wysokości to prawdziwy sygnał', () => {
  const rect = areaToCropRect({ x: 220, width: 1480 }, { x: 0, y: 0 }, 1920, 599, 1);
  assert.equal(rect.height, 599);
  assert.equal(rect.y, 0);
});

test('areaToCropRect: przelicza do skali zrzutu (deviceScaleFactor)', () => {
  const rect = areaToCropRect({ x: 100, width: 200 }, { x: 0, y: 0 }, 3840, 400, 2);
  assert.deepEqual(rect, { x: 200, y: 0, width: 400, height: 400 });
});

test('areaToCropRect: przycina do granic obrazu, gdy pomiar wystaje poza zrzut o ułamek piksela', () => {
  const rect = areaToCropRect({ x: 1900, width: 30 }, { x: 0, y: 0 }, 1920, 100, 1);
  assert.equal(rect.x, 1900);
  assert.equal(rect.width, 20);
});

test('resolveMaskOrigin: bez konfiguracji obszaru zostaje przy origin całej sekcji (regresja nagłówka/stopki)', () => {
  const sectionBox = { x: 0, y: 1322 };
  assert.deepEqual(resolveMaskOrigin(null, sectionBox), sectionBox);
});

test('resolveMaskOrigin: z obszarem przesuwa origin X do lewej krawędzi obszaru, Y zostaje sekcji', () => {
  // Maskowanie liczy współrzędne względem porównywanego obszaru —
  // po przycięciu w poziomie origin X musi być krawędzią obszaru, nie sekcji,
  // inaczej maski rozjadą się o offset. Oś Y nie jest przycinana.
  const sectionBox = { x: 0, y: 1322 };
  const area = { x: 50, width: 1820 };
  assert.deepEqual(resolveMaskOrigin(area, sectionBox), { x: 50, y: 1322 });
});

test('sumVisibleBoundingBoxes: ramka z clipsContent przycina dzieci, więc liczy się tylko jej prostokąt', () => {
  const node = {
    absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
    children: [
      {
        clipsContent: true,
        absoluteBoundingBox: { x: 0, y: 0, width: 50, height: 50 },
        children: [{ absoluteBoundingBox: { x: 0, y: 0, width: 300, height: 50 } }],
      },
    ],
  };
  assert.deepEqual(sumVisibleBoundingBoxes(node), { x: 0, y: 0, width: 100, height: 100 });
});

test('cropPng: prostokąt wychodzący poza obraz to czytelny błąd, a nie śmieci', () => {
  const source = coordinatePng(10, 10);
  assert.throws(() => cropPng(source, { x: 5, y: 0, width: 10, height: 10 }), /crop|poza obraz/);
});

// Obszar porównania per breakpoint: na mobile kontener treści bywa węższy niż
// ramka węzła (węzeł ma szerokość ekranu), więc przycinanie trzeba móc wyłączyć.

test('areaConfigFor: nadpisanie per breakpoint ma pierwszeństwo, null wyłącza przycinanie', () => {
  const nodes = { 'home-hero': { desktop: '1:1', area: { selector: '.fwp-container', mobile: null } } };
  assert.deepEqual(areaConfigFor('home-hero', nodes, 'desktop'), { selector: '.fwp-container' });
  assert.equal(areaConfigFor('home-hero', nodes, 'mobile'), null);
});

test('areaConfigFor: nadpisanie per breakpoint może wskazać inny selektor', () => {
  const nodes = { 'home-news': { area: { selector: '.fwp-wrapper', mobile: { selector: '.fwp-news__list' } } } };
  assert.deepEqual(areaConfigFor('home-news', nodes, 'mobile'), { selector: '.fwp-news__list' });
});

test('parseArgs: slug, flaga --mobile i pomoc', () => {
  assert.deepEqual(parseArgs(['home-hero', '--mobile']), { slug: 'home-hero', breakpoint: 'mobile', help: false });
  assert.deepEqual(parseArgs([]), { slug: null, breakpoint: 'desktop', help: false });
  assert.equal(parseArgs(['--help']).help, true);
});

test('planRun: jest węzeł — pełne porównanie', () => {
  const plan = planRun('home-hero', 'desktop', { 'home-hero': { desktop: '1:1', mobile: null } });
  assert.deepEqual(plan, { action: 'porownaj', selector: '.fwp-hero', nodeId: '1:1' });
});

test('planRun: "mobile": null to nie błąd, tylko sprawdzenie obecności', () => {
  const plan = planRun('home-hero', 'mobile', { 'home-hero': { desktop: '1:1', mobile: null } });
  assert.equal(plan.action, 'obecnosc');
  assert.equal(plan.selector, '.fwp-hero');
  assert.match(plan.message, /brak makiety mobilnej/i);
  assert.match(plan.message, /weryfikuj zrzutem/);
});

test('planRun: brak węzła desktopowego to błąd konfiguracji', () => {
  assert.throws(() => planRun('home-hero', 'desktop', { 'home-hero': { desktop: null } }), /desktop/);
});

// runParity z wstrzykniętą, udawaną przeglądarką — ścieżki decydujące o kodzie
// wyjścia bez Chromium i bez WordPressa.

const projekt = {
  urlLokalny: 'http://localhost:8888',
  figma: { fileKey: 'KEY' },
  szerokosciTestowe: { mobile: 393, tablet: 1024, desktop: 1440, wide: 1920 },
};

function fakeBrowser({ present }) {
  const calls = { viewport: null, goto: null, screenshots: [], closed: false };
  const first = {
    scrollIntoViewIfNeeded: async () => {},
    screenshot: async (opts) => {
      calls.screenshots.push(opts?.path ?? null);
      return Buffer.alloc(0);
    },
  };
  const page = {
    goto: async (url) => {
      calls.goto = url;
    },
    evaluate: async () => {},
    locator: () => ({ count: async () => (present ? 1 : 0), first: () => first }),
  };
  return {
    calls,
    openPage: async (viewport) => {
      calls.viewport = viewport;
      return { page, close: async () => { calls.closed = true; } };
    },
  };
}

function capture() {
  const out = { log: [], error: [] };
  return {
    out,
    log: (m) => out.log.push(m),
    warn: (m) => out.log.push(m),
    error: (m) => out.error.push(m),
  };
}

const mobileNullNodes = { 'home-hero': { desktop: '1:1', mobile: null } };

test('runParity: "mobile": null i sekcja jest na stronie — kod 0, komunikat, zrzut do obejrzenia', async () => {
  const browser = fakeBrowser({ present: true });
  const io = capture();
  const code = await runParity(['home-hero', '--mobile'], {
    ...io,
    projekt,
    nodes: mobileNullNodes,
    openPage: browser.openPage,
    ensureReference: async () => assert.fail('bez makiety nie wolno pobierać referencji'),
  });
  assert.equal(code, 0);
  assert.deepEqual(browser.calls.viewport, { width: 393, height: 852 });
  assert.equal(browser.calls.goto, 'http://localhost:8888/');
  assert.match(io.out.log.join('\n'), /brak makiety mobilnej — wersja mobilna jest projektowana, porównanie pominięte, weryfikuj zrzutem/i);
  assert.equal(browser.calls.screenshots.length, 1);
  assert.match(browser.calls.screenshots[0], /home-hero\.mobile\.actual\.png$/);
  assert.equal(browser.calls.closed, true);
});

test('runParity: "mobile": null, ale sekcji nie ma na stronie — kod 1', async () => {
  const browser = fakeBrowser({ present: false });
  const io = capture();
  const code = await runParity(['home-hero', '--mobile'], {
    ...io,
    projekt,
    nodes: mobileNullNodes,
    openPage: browser.openPage,
  });
  assert.equal(code, 1);
  assert.match(io.out.error.join('\n'), /\.fwp-hero.*nie występuje/);
  assert.equal(browser.calls.closed, true);
});

test('runParity: desktop, sekcji nie ma na stronie — kod 1, porównanie przy szerokości wide', async () => {
  const browser = fakeBrowser({ present: false });
  const io = capture();
  const code = await runParity(['home-hero'], {
    ...io,
    projekt,
    nodes: mobileNullNodes,
    openPage: browser.openPage,
    ensureReference: async () => '/nie/istnieje.png',
  });
  assert.equal(code, 1);
  assert.deepEqual(browser.calls.viewport, { width: 1920, height: 1080 });
});

test('runParity: viewport porównania ma szerokość ramki z figma.ramki, nie szerokości testowej', async () => {
  const browser = fakeBrowser({ present: false });
  const io = capture();
  await runParity(['home-hero', '--mobile'], {
    ...io,
    projekt: { ...projekt, figma: { fileKey: 'KEY', ramki: { desktop: 1440, mobile: 375 } } },
    nodes: mobileNullNodes,
    openPage: browser.openPage,
  });
  assert.deepEqual(browser.calls.viewport, { width: 375, height: 852 });
  assert.doesNotMatch(io.out.log.join('\n'), /figma\.ramki/);
});

test('runParity: bez figma.ramki spada na szerokość testową i ostrzega', async () => {
  const browser = fakeBrowser({ present: false });
  const io = capture();
  await runParity(['home-hero', '--mobile'], {
    ...io,
    projekt,
    nodes: mobileNullNodes,
    openPage: browser.openPage,
  });
  assert.deepEqual(browser.calls.viewport, { width: 393, height: 852 });
  assert.match(io.out.log.join('\n'), /uzupełnij figma\.ramki w projekt\.json \(faza rekonesansu\)/);
});

test('runParity: nieznany slug — kod 1 bez otwierania przeglądarki', async () => {
  const io = capture();
  const code = await runParity(['home-nope'], {
    ...io,
    projekt,
    nodes: mobileNullNodes,
    openPage: async () => assert.fail('nie wolno otwierać przeglądarki'),
  });
  assert.equal(code, 1);
  assert.match(io.out.error.join('\n'), /home-nope/);
});

test('runParity: bez argumentów wypisuje pomoc i kończy kodem 1', async () => {
  const io = capture();
  const code = await runParity([], { ...io });
  assert.equal(code, 1);
  assert.match(io.out.log.join('\n'), /Użycie: npm run parity/);
});
