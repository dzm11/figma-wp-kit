#!/usr/bin/env node
/**
 * Sprawdza, czy środowisko jest gotowe do pracy: Node, konfiguracja projektu,
 * token Figmy (i czy faktycznie działa), Docker oraz lokalny WordPress.
 * Przy każdym niespełnionym warunku wypisuje, jak go naprawić.
 *
 * Czyste funkcje `ocen*` zamieniają surowy wynik sprawdzenia (status HTTP,
 * kod wyjścia procesu) na werdykt z instrukcją naprawy — to one są testowane.
 * Sieć i procesy są za cienką, wstrzykiwaną warstwą w `runPreflight`.
 *
 * Użycie: npm run sprawdz
 */

import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readProjekt } from './lib/projekt.mjs';
import { readEnvToken, readDotenv, API } from './figma-export.mjs';

export const MIN_NODE_MAJOR = 20;

const ok = (nazwa, szczegol) => ({ nazwa, status: 'ok', szczegol });
const blad = (nazwa, szczegol, naprawa) => ({ nazwa, status: 'blad', szczegol, naprawa });
const uwaga = (nazwa, szczegol) => ({ nazwa, status: 'uwaga', szczegol });

// ---------------------------------------------------------------------------
// Oceny — czyste funkcje
// ---------------------------------------------------------------------------

export function ocenNode(version) {
  const major = Number(String(version).replace(/^v/, '').split('.')[0]);
  if (major >= MIN_NODE_MAJOR) {
    return ok('Node', `${version} (wymagany ≥ ${MIN_NODE_MAJOR})`);
  }
  return blad(
    'Node',
    `${version} — za stary (wymagany ≥ ${MIN_NODE_MAJOR})`,
    'Zainstaluj aktualny Node LTS (np. brew install node albo nvm install --lts).'
  );
}

export function ocenProjekt(projekt, bladOdczytu = null) {
  if (bladOdczytu) {
    return blad('projekt.json', bladOdczytu, 'Przywróć projekt.json z repozytorium zestawu i uruchom npm run setup.');
  }
  if (projekt?.skonfigurowany !== true) {
    return blad('projekt.json', 'projekt nie jest skonfigurowany (skonfigurowany: false)', 'Uruchom npm run setup.');
  }
  if (!String(projekt?.figma?.fileKey ?? '').trim()) {
    return blad('projekt.json', 'brak figma.fileKey', 'Uruchom npm run setup i podaj link do pliku Figmy.');
  }
  return ok('projekt.json', `klient: ${projekt.klient || '(bez nazwy)'}, plik Figmy: ${projekt.figma.fileKey}`);
}

/**
 * Werdykt dla tokenu Figmy. `wynik` to { brakTokenu } albo { status, body, blad }
 * z zapytania do API; `fileKey` pusty oznacza, że sprawdzano tylko ważność
 * tokenu (/v1/me), bez dostępu do konkretnego pliku.
 */
export function ocenToken(wynik, fileKey) {
  const nazwa = 'Token Figmy';
  if (wynik.brakTokenu) {
    return blad(
      nazwa,
      'brak FIGMA_TOKEN w zmiennych środowiska i w .env',
      'Dodaj do .env linię FIGMA_TOKEN=figd_... — token z Figmy: Settings → Security → ' +
        'Personal access tokens, zakres File content: read.'
    );
  }
  if (wynik.blad) {
    return blad(nazwa, `brak połączenia z api.figma.com (${wynik.blad})`, 'Sprawdź połączenie z internetem i spróbuj ponownie.');
  }
  if (wynik.status === 200) {
    if (fileKey) {
      return ok(nazwa, `działa — plik „${wynik.body?.name ?? '?'}”`);
    }
    return ok(nazwa, `ważny (konto: ${wynik.body?.handle ?? wynik.body?.email ?? '?'}), dostęp do pliku sprawdzisz po npm run setup`);
  }
  if (wynik.status === 403) {
    return blad(
      nazwa,
      'token bez dostępu do pliku albo nieważny (403)',
      'Settings → Security → Personal access tokens, zakres File content: read; ' +
        'upewnij się, że konto tokenu ma dostęp do pliku.'
    );
  }
  if (wynik.status === 404) {
    return blad(nazwa, 'plik nie istnieje (404)', 'Sprawdź figma.fileKey w projekt.json (npm run setup).');
  }
  if (wynik.status === 429) {
    return blad(nazwa, 'limit zapytań Figma API (429)', 'Odczekaj minutę i uruchom ponownie.');
  }
  return blad(nazwa, `Figma API zwróciło ${wynik.status}`, 'Spróbuj ponownie za chwilę; sprawdź status.figma.com.');
}

/**
 * Werdykt dla `docker compose version`. `wynik` = { kod, stdout, stderr, blad }.
 * Na macOS z Apple Silicon /usr/local/bin/docker bywa starą binarką x86 bez
 * wtyczki compose, która przesłania natywną z Homebrew — stąd podpowiedź PATH.
 */
export function ocenDocker(wynik, { platform, arch } = {}) {
  const nazwa = 'Docker Compose';
  if (wynik.kod === 0) {
    return ok(nazwa, String(wynik.stdout ?? '').trim().split('\n')[0] || 'dostępny');
  }
  const appleSilicon = platform === 'darwin' && arch === 'arm64';
  const pathHint = appleSilicon
    ? ' Na Apple Silicon /usr/local/bin/docker bywa binarką x86 bez compose — ' +
      'uruchom z natywną: export PATH=/opt/homebrew/bin:$PATH'
    : '';
  if (wynik.blad === 'ENOENT') {
    return blad(nazwa, 'polecenie docker nie jest dostępne', `Zainstaluj Docker Desktop albo colima + docker + docker-compose.${pathHint}`);
  }
  return blad(
    nazwa,
    `docker compose nie działa (${String(wynik.stderr || wynik.stdout || `kod ${wynik.kod}`).trim().split('\n')[0]})`,
    `Zainstaluj wtyczkę compose (brew install docker-compose).${pathHint}`
  );
}

export function ocenSilnikDockera(wynik) {
  const nazwa = 'Silnik Dockera';
  if (wynik.kod === 0) {
    return ok(nazwa, `działa (serwer ${String(wynik.stdout ?? '').trim() || '?'})`);
  }
  return blad(nazwa, 'nie odpowiada', 'Uruchom Docker Desktop albo colima start.');
}

export function ocenWordpress(wynik, url) {
  const nazwa = 'WordPress';
  if (wynik.status === 200) {
    return ok(nazwa, `${url} odpowiada (200)`);
  }
  const powod = wynik.blad ? `nie odpowiada (${wynik.blad})` : `odpowiada kodem ${wynik.status}`;
  return blad(nazwa, `${url} ${powod}`, 'Uruchom npm run env:start (pierwsze uruchomienie trwa kilka minut).');
}

export const BRIDGE = uwaga(
  'Figma Desktop Bridge',
  'sprawdza Claude przez figma_get_status (MCP figma-console)'
);

const ZNAK = { ok: '✔', blad: '✖', uwaga: '⚠' };

export function formatuj(wyniki) {
  const linie = ['Sprawdzanie środowiska', ''];
  for (const w of wyniki) {
    linie.push(`${ZNAK[w.status]} ${w.nazwa}: ${w.szczegol}`);
    if (w.status === 'blad' && w.naprawa) {
      linie.push(`    → ${w.naprawa}`);
    }
  }
  const twarde = wyniki.filter((w) => w.status !== 'uwaga');
  const spelnione = twarde.filter((w) => w.status === 'ok').length;
  linie.push('');
  linie.push(
    spelnione === twarde.length
      ? `Gotowe: ${spelnione}/${twarde.length} warunków spełnionych.`
      : `Spełnione ${spelnione}/${twarde.length}. Popraw pozycje oznaczone ✖ i uruchom npm run sprawdz ponownie.`
  );
  return linie.join('\n');
}

export function kodWyjscia(wyniki) {
  return wyniki.some((w) => w.status === 'blad') ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Cienka warstwa: sieć i procesy
// ---------------------------------------------------------------------------

function uruchom(cmd, args, timeout = 10000) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout }, (error, stdout, stderr) => {
      if (error && error.code === 'ENOENT') {
        resolve({ kod: null, stdout, stderr, blad: 'ENOENT' });
        return;
      }
      resolve({ kod: error ? (typeof error.code === 'number' ? error.code : 1) : 0, stdout, stderr });
    });
  });
}

async function pobierz(url, init = {}, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(10000) });
    let body = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { status: response.status, body };
  } catch (error) {
    return { blad: error.cause?.code ?? error.name ?? error.message };
  }
}

export async function runPreflight(deps = {}) {
  const fetchImpl = deps.fetch ?? fetch;
  const run = deps.run ?? uruchom;
  const env = deps.env ?? process.env;
  const wyniki = [];

  wyniki.push(ocenNode(deps.nodeVersion ?? process.version));

  let projekt = null;
  try {
    projekt = deps.projekt ?? readProjekt();
    wyniki.push(ocenProjekt(projekt));
  } catch (error) {
    wyniki.push(ocenProjekt(null, error.message));
  }

  const fileKey = String(projekt?.figma?.fileKey ?? '').trim();
  let token = null;
  try {
    token = readEnvToken(env, deps.dotenv ?? readDotenv());
  } catch {
    token = null;
  }
  if (!token) {
    wyniki.push(ocenToken({ brakTokenu: true }, fileKey));
  } else {
    const url = fileKey ? `${API}/files/${fileKey}?depth=1` : `${API}/me`;
    wyniki.push(ocenToken(await pobierz(url, { headers: { 'X-Figma-Token': token } }, fetchImpl), fileKey));
  }

  const compose = ocenDocker(await run('docker', ['compose', 'version']), {
    platform: deps.platform ?? process.platform,
    arch: deps.arch ?? process.arch,
  });
  wyniki.push(compose);
  if (compose.status === 'ok') {
    wyniki.push(ocenSilnikDockera(await run('docker', ['info', '--format', '{{.ServerVersion}}'])));
  }

  const wpUrl = projekt?.urlLokalny || 'http://localhost:8888';
  const wp = await pobierz(wpUrl, { redirect: 'follow' }, fetchImpl);
  wyniki.push(ocenWordpress(wp, wpUrl));

  wyniki.push(BRIDGE);
  return wyniki;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runPreflight()
    .then((wyniki) => {
      console.log(formatuj(wyniki));
      process.exitCode = kodWyjscia(wyniki);
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
