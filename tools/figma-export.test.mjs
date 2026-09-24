import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readEnvToken,
  normalizeNodeId,
  parseNodeArg,
  imageUrlEndpoint,
  nodesEndpoint,
  describeApiError,
  planReferenceCrop,
  refPath,
  findPageFrame,
  ancestorsEndpoint,
} from './figma-export.mjs';

test('readEnvToken bierze token ze zmiennych środowiska', () => {
  assert.equal(readEnvToken({ FIGMA_TOKEN: 'figd_abc' }), 'figd_abc');
});

test('readEnvToken sięga do .env, gdy zmiennej nie ma', () => {
  const dotenv = '# komentarz\nFIGMA_TOKEN=figd_z_pliku\nINNE=1\n';
  assert.equal(readEnvToken({}, dotenv), 'figd_z_pliku');
});

test('readEnvToken zdejmuje cudzysłowy z wartości w .env', () => {
  assert.equal(readEnvToken({}, 'FIGMA_TOKEN="figd_x"\n'), 'figd_x');
});

test('readEnvToken tłumaczy, co zrobić, gdy tokena nie ma nigdzie', () => {
  assert.throws(() => readEnvToken({}, ''), /FIGMA_TOKEN/);
  assert.throws(() => readEnvToken({}, ''), /\.env/);
});

test('normalizeNodeId zamienia myślnik z URL-a na dwukropek z API', () => {
  assert.equal(normalizeNodeId('470-29376'), '470:29376');
  assert.equal(normalizeNodeId('470:29376'), '470:29376');
});

test('normalizeNodeId radzi sobie z zagnieżdżoną instancją, która ma kilka myślników', () => {
  assert.equal(normalizeNodeId('I2001-3538;2001-3150'), 'I2001:3538;2001:3150');
  assert.equal(normalizeNodeId('I2001:3538;2001:3150'), 'I2001:3538;2001:3150');
});

test('imageUrlEndpoint składa poprawny adres z wieloma węzłami', () => {
  const url = imageUrlEndpoint('KEY', ['1-2', '3:4'], { scale: 2, format: 'png' });
  assert.match(url, /^https:\/\/api\.figma\.com\/v1\/images\/KEY\?/);
  assert.match(url, /ids=1%3A2%2C3%3A4/);
  assert.match(url, /scale=2/);
  assert.match(url, /format=png/);
});

test('imageUrlEndpoint odrzuca skalę spoza zakresu dopuszczanego przez API', () => {
  assert.throws(() => imageUrlEndpoint('KEY', ['1-2'], { scale: 5 }), /skala/i);
});

test('readEnvToken pomija pustą wartość w .env i tłumaczy, co zrobić', () => {
  assert.throws(() => readEnvToken({}, 'FIGMA_TOKEN=\n'), /FIGMA_TOKEN/);
});

test('parseNodeArg przyjmuje formę z URL-a, z API i cały link z node-id', () => {
  assert.equal(parseNodeArg('470-29428'), '470:29428');
  assert.equal(parseNodeArg('470:29428'), '470:29428');
  assert.equal(parseNodeArg('I2001-3538;2001-3150'), 'I2001:3538;2001:3150');
  assert.equal(
    parseNodeArg('https://www.figma.com/design/KEY/Plik?node-id=470-29428&t=abc'),
    '470:29428'
  );
});

test('parseNodeArg odrzuca coś, co nie jest identyfikatorem węzła', () => {
  assert.throws(() => parseNodeArg('--format'), /identyfikator/);
  assert.throws(() => parseNodeArg('https://www.figma.com/design/KEY/Plik'), /node-id/);
});

test('imageUrlEndpoint przekazuje dodatkowe parametry (np. dla SVG)', () => {
  const url = imageUrlEndpoint('KEY', ['1:2'], {
    scale: 1,
    format: 'svg',
    extra: { svg_outline_text: false, svg_include_id: false },
  });
  assert.match(url, /format=svg/);
  assert.match(url, /svg_outline_text=false/);
  assert.match(url, /svg_include_id=false/);
});

test('imageUrlEndpoint odrzuca format, którego API nie zna', () => {
  assert.throws(() => imageUrlEndpoint('KEY', ['1:2'], { format: 'webp' }), /webp/);
});

test('nodesEndpoint składa adres z listą węzłów i opcjonalną głębokością', () => {
  const url = nodesEndpoint('KEY', ['1-2', '3:4'], { depth: 1 });
  assert.match(url, /^https:\/\/api\.figma\.com\/v1\/files\/KEY\/nodes\?/);
  assert.match(url, /ids=1%3A2%2C3%3A4/);
  assert.match(url, /depth=1/);
  assert.doesNotMatch(nodesEndpoint('KEY', ['1:2']), /depth/);
});

test('describeApiError podpowiada naprawę dla 403, 404 i 429', () => {
  assert.match(describeApiError(403), /token/);
  assert.match(describeApiError(403), /File content: read/);
  assert.match(describeApiError(404), /fileKey/);
  assert.match(describeApiError(429), /odczekaj/);
  assert.match(describeApiError(500, 'boom'), /500.*boom/);
});

test('refPath: skala 1 to referencja dla parity, inna skala to osobny plik', () => {
  assert.match(refPath('home-hero', 'desktop'), /docs\/figma\/ref\/home-hero\.desktop\.png$/);
  assert.match(refPath('home-hero', 'mobile', 2), /home-hero\.mobile@2x\.png$/);
});

// Automatyczne ustalanie przycięcia referencji przy pobieraniu.

const footer = {
  absoluteBoundingBox: { x: 50, y: 1000, width: 1820, height: 1024 },
  children: [{ absoluteBoundingBox: { x: 50, y: 1000, width: 1599, height: 1099 } }],
};

test('planReferenceCrop: eksport o wymiarach ramki nie wymaga przycięcia', () => {
  const node = { absoluteBoundingBox: { x: 0, y: 0, width: 393, height: 96 } };
  assert.deepEqual(planReferenceCrop(node, 393, 96), { status: 'zgodny' });
});

test('planReferenceCrop: eksport o wymiarach sumy potomków daje prostokąt ramki', () => {
  assert.deepEqual(planReferenceCrop(footer, 1820, 1099), {
    status: 'przyciecie',
    crop: { x: 0, y: 0, width: 1820, height: 1024 },
  });
});

test('planReferenceCrop: nadmiar z lewej i z góry przesuwa początek przycięcia', () => {
  const node = {
    absoluteBoundingBox: { x: 100, y: 100, width: 50, height: 50 },
    children: [{ absoluteBoundingBox: { x: 80, y: 90, width: 20, height: 20 } }],
  };
  assert.deepEqual(planReferenceCrop(node, 70, 60), {
    status: 'przyciecie',
    crop: { x: 20, y: 10, width: 50, height: 50 },
  });
});

test('planReferenceCrop: toleruje ułamkowe współrzędne Figmy (±1 px)', () => {
  const node = { absoluteBoundingBox: { x: 0.5, y: 0, width: 392.6, height: 95.5 } };
  assert.equal(planReferenceCrop(node, 393, 96).status, 'zgodny');
});

test('planReferenceCrop: eksport niepasujący do niczego to "nieznany" — bez zgadywania', () => {
  const plan = planReferenceCrop(footer, 1900, 1150);
  assert.equal(plan.status, 'nieznany');
  assert.match(plan.message, /1900x1150/);
});

// Ramka strony dla figma.ramki: /files?ids= zwraca ścieżkę od korzenia do węzła.

const drzewo = {
  id: '0:0',
  type: 'DOCUMENT',
  children: [
    {
      id: '1:1',
      type: 'CANVAS',
      children: [
        {
          id: '2:1',
          type: 'SECTION',
          name: 'Desktop',
          absoluteBoundingBox: { x: 0, y: 0, width: 5000, height: 9000 },
          children: [
            {
              id: '3:1',
              type: 'FRAME',
              name: 'Strona główna',
              absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 8000 },
              children: [
                {
                  id: '4:1',
                  type: 'FRAME',
                  name: 'Page',
                  absoluteBoundingBox: { x: 0, y: 0, width: 1440, height: 7900 },
                  children: [{ id: '5:1', type: 'FRAME', name: 'Hero', absoluteBoundingBox: { x: 80, y: 100, width: 1280, height: 600 } }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

test('findPageFrame: najbardziej zewnętrzna ramka na ścieżce, z pominięciem sekcji płótna', () => {
  assert.deepEqual(findPageFrame(drzewo, '5-1'), { id: '3:1', name: 'Strona główna', width: 1440 });
});

test('findPageFrame: węzeł leżący wprost na płótnie jest swoją własną ramką', () => {
  assert.deepEqual(findPageFrame(drzewo, '3:1'), { id: '3:1', name: 'Strona główna', width: 1440 });
});

test('findPageFrame: brak węzła w drzewie albo brak ramki na ścieżce daje null', () => {
  assert.equal(findPageFrame(drzewo, '9:9'), null);
  assert.equal(findPageFrame(drzewo, '2:1'), null);
});

test('ancestorsEndpoint pyta /files z parametrem ids w formie API', () => {
  assert.equal(ancestorsEndpoint('KEY', '12-345'), 'https://api.figma.com/v1/files/KEY?ids=12%3A345');
});
