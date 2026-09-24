import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ocenNode,
  ocenProjekt,
  ocenToken,
  ocenDocker,
  ocenSilnikDockera,
  ocenWordpress,
  formatuj,
  kodWyjscia,
  runPreflight,
  BRIDGE,
} from './preflight.mjs';

test('ocenNode: 20 i wyżej przechodzi, niżej nie', () => {
  assert.equal(ocenNode('v20.0.0').status, 'ok');
  assert.equal(ocenNode('v22.3.1').status, 'ok');
  const stary = ocenNode('v18.19.0');
  assert.equal(stary.status, 'blad');
  assert.match(stary.naprawa, /Node/);
});

test('ocenProjekt: nieskonfigurowany projekt odsyła do npm run setup', () => {
  const wynik = ocenProjekt({ skonfigurowany: false, figma: { fileKey: '' } });
  assert.equal(wynik.status, 'blad');
  assert.match(wynik.naprawa, /npm run setup/);
});

test('ocenProjekt: skonfigurowany bez fileKey to nadal błąd', () => {
  const wynik = ocenProjekt({ skonfigurowany: true, figma: { fileKey: ' ' } });
  assert.equal(wynik.status, 'blad');
  assert.match(wynik.szczegol, /fileKey/);
});

test('ocenProjekt: skonfigurowany z fileKey przechodzi', () => {
  const wynik = ocenProjekt({ skonfigurowany: true, klient: 'Acme', figma: { fileKey: 'ABC' } });
  assert.equal(wynik.status, 'ok');
  assert.match(wynik.szczegol, /Acme/);
});

test('ocenProjekt: błąd odczytu pliku jest raportowany', () => {
  assert.equal(ocenProjekt(null, 'Brak pliku').status, 'blad');
});

test('ocenToken: brak tokenu mówi, gdzie go wygenerować', () => {
  const wynik = ocenToken({ brakTokenu: true }, 'ABC');
  assert.equal(wynik.status, 'blad');
  assert.match(wynik.naprawa, /FIGMA_TOKEN/);
  assert.match(wynik.naprawa, /File content: read/);
});

test('ocenToken: 200 z plikiem wypisuje nazwę pliku', () => {
  const wynik = ocenToken({ status: 200, body: { name: 'Strona klienta' } }, 'ABC');
  assert.equal(wynik.status, 'ok');
  assert.match(wynik.szczegol, /Strona klienta/);
});

test('ocenToken: 200 bez fileKey potwierdza tylko ważność tokenu', () => {
  const wynik = ocenToken({ status: 200, body: { handle: 'piotr' } }, '');
  assert.equal(wynik.status, 'ok');
  assert.match(wynik.szczegol, /piotr/);
  assert.match(wynik.szczegol, /npm run setup/);
});

test('ocenToken: 403 tłumaczy przyczynę i naprawę', () => {
  const wynik = ocenToken({ status: 403 }, 'ABC');
  assert.equal(wynik.status, 'blad');
  assert.match(wynik.szczegol, /bez dostępu do pliku albo nieważny/);
  assert.match(wynik.naprawa, /Settings → Security → Personal access tokens/);
  assert.match(wynik.naprawa, /File content: read/);
});

test('ocenToken: 404 wskazuje fileKey, błąd sieci — połączenie', () => {
  assert.match(ocenToken({ status: 404 }, 'ABC').naprawa, /fileKey/);
  assert.match(ocenToken({ blad: 'ENOTFOUND' }, 'ABC').szczegol, /ENOTFOUND/);
});

test('ocenDocker: działający compose przechodzi', () => {
  const wynik = ocenDocker({ kod: 0, stdout: 'Docker Compose version v2.29.1\n' });
  assert.equal(wynik.status, 'ok');
  assert.match(wynik.szczegol, /v2\.29\.1/);
});

test('ocenDocker: brak compose na Apple Silicon podpowiada PATH z Homebrew', () => {
  const wynik = ocenDocker(
    { kod: 1, stderr: "docker: 'compose' is not a docker command." },
    { platform: 'darwin', arch: 'arm64' }
  );
  assert.equal(wynik.status, 'blad');
  assert.match(wynik.naprawa, /export PATH=\/opt\/homebrew\/bin:\$PATH/);
});

test('ocenDocker: poza Apple Silicon bez podpowiedzi o Homebrew', () => {
  const wynik = ocenDocker({ kod: 1, stderr: 'x' }, { platform: 'linux', arch: 'x64' });
  assert.doesNotMatch(wynik.naprawa, /homebrew/);
});

test('ocenDocker: brak polecenia docker', () => {
  const wynik = ocenDocker({ kod: null, blad: 'ENOENT' }, { platform: 'linux', arch: 'x64' });
  assert.equal(wynik.status, 'blad');
  assert.match(wynik.szczegol, /nie jest dostępne/);
});

test('ocenSilnikDockera: zatrzymany silnik odsyła do colima start / Docker Desktop', () => {
  assert.equal(ocenSilnikDockera({ kod: 0, stdout: '27.1\n' }).status, 'ok');
  assert.match(ocenSilnikDockera({ kod: 1 }).naprawa, /colima start/);
});

test('ocenWordpress: 200 przechodzi, brak odpowiedzi odsyła do env:start', () => {
  assert.equal(ocenWordpress({ status: 200 }, 'http://localhost:8888').status, 'ok');
  const wynik = ocenWordpress({ blad: 'ECONNREFUSED' }, 'http://localhost:8888');
  assert.equal(wynik.status, 'blad');
  assert.match(wynik.szczegol, /ECONNREFUSED/);
  assert.match(wynik.naprawa, /npm run env:start/);
  assert.match(ocenWordpress({ status: 500 }, 'http://x').szczegol, /500/);
});

test('Figma Desktop Bridge to stała uwaga, nie warunek', () => {
  assert.equal(BRIDGE.status, 'uwaga');
  assert.match(BRIDGE.szczegol, /figma_get_status/);
});

test('formatuj: znaczniki ✔/✖/⚠ i instrukcja naprawy pod błędem', () => {
  const tekst = formatuj([
    { nazwa: 'Node', status: 'ok', szczegol: 'v22' },
    { nazwa: 'Token Figmy', status: 'blad', szczegol: '403', naprawa: 'Wygeneruj nowy.' },
    BRIDGE,
  ]);
  assert.match(tekst, /✔ Node: v22/);
  assert.match(tekst, /✖ Token Figmy: 403\n    → Wygeneruj nowy\./);
  assert.match(tekst, /⚠ Figma Desktop Bridge: sprawdza Claude przez figma_get_status \(MCP figma-console\)/);
  assert.match(tekst, /Spełnione 1\/2/);
});

test('kodWyjscia: 1 przy jakimkolwiek błędzie, uwaga nie przewraca wyniku', () => {
  assert.equal(kodWyjscia([{ status: 'ok' }, BRIDGE]), 0);
  assert.equal(kodWyjscia([{ status: 'ok' }, { status: 'blad' }]), 1);
});

// runPreflight z wstrzykniętą siecią i procesami.

function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    for (const [prefix, response] of routes) {
      if (url.startsWith(prefix)) {
        if (response instanceof Error) throw response;
        return { status: response.status, json: async () => response.body ?? null };
      }
    }
    throw new Error(`nieoczekiwany adres ${url}`);
  };
  return { impl, calls };
}

const skonfigurowany = {
  skonfigurowany: true,
  klient: 'Acme',
  urlLokalny: 'http://localhost:8888',
  figma: { fileKey: 'KEY' },
};

test('runPreflight: wszystko działa — sześć pozycji, kod 0, token sprawdzony na pliku', async () => {
  const net = fakeFetch([
    ['https://api.figma.com/v1/files/KEY?depth=1', { status: 200, body: { name: 'Makieta' } }],
    ['http://localhost:8888', { status: 200 }],
  ]);
  const wyniki = await runPreflight({
    fetch: net.impl,
    run: async () => ({ kod: 0, stdout: 'ok' }),
    env: { FIGMA_TOKEN: 'figd_x' },
    dotenv: '',
    projekt: skonfigurowany,
    nodeVersion: 'v22.0.0',
  });
  assert.equal(kodWyjscia(wyniki), 0);
  assert.deepEqual(wyniki.map((w) => w.nazwa), [
    'Node',
    'projekt.json',
    'Token Figmy',
    'Docker Compose',
    'Silnik Dockera',
    'WordPress',
    'Figma Desktop Bridge',
  ]);
  assert.equal(net.calls[0].init.headers['X-Figma-Token'], 'figd_x');
});

test('runPreflight: nieskonfigurowany projekt — token sprawdzany na /v1/me, kod 1', async () => {
  const net = fakeFetch([
    ['https://api.figma.com/v1/me', { status: 200, body: { handle: 'piotr' } }],
    ['http://localhost:8888', new Error('fetch failed')],
  ]);
  const wyniki = await runPreflight({
    fetch: net.impl,
    run: async () => ({ kod: 1, stderr: "'compose' is not a docker command" }),
    env: { FIGMA_TOKEN: 'figd_x' },
    dotenv: '',
    projekt: { skonfigurowany: false, urlLokalny: 'http://localhost:8888', figma: { fileKey: '' } },
    nodeVersion: 'v22.0.0',
    platform: 'darwin',
    arch: 'arm64',
  });
  assert.equal(kodWyjscia(wyniki), 1);
  const nazwy = wyniki.map((w) => w.nazwa);
  assert.ok(!nazwy.includes('Silnik Dockera'), 'bez compose nie sprawdzamy silnika');
  assert.equal(wyniki.find((w) => w.nazwa === 'projekt.json').status, 'blad');
  assert.equal(wyniki.find((w) => w.nazwa === 'Token Figmy').status, 'ok');
  assert.equal(wyniki.find((w) => w.nazwa === 'WordPress').status, 'blad');
});

test('runPreflight: brak tokenu nie wysyła zapytania do Figmy', async () => {
  const net = fakeFetch([['http://localhost:8888', { status: 200 }]]);
  const wyniki = await runPreflight({
    fetch: net.impl,
    run: async () => ({ kod: 0, stdout: 'ok' }),
    env: {},
    dotenv: '',
    projekt: skonfigurowany,
    nodeVersion: 'v22.0.0',
  });
  assert.equal(wyniki.find((w) => w.nazwa === 'Token Figmy').status, 'blad');
  assert.ok(net.calls.every((c) => !c.url.includes('figma.com')));
});
