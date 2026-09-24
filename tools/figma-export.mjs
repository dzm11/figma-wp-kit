#!/usr/bin/env node
/**
 * Pobiera referencje porównawcze (PNG węzłów) z Figma REST API i zawiera wspólną
 * warstwę dostępu do API, z której korzystają figma-assets.mjs, parity.mjs
 * i preflight.mjs.
 *
 * Używamy REST, a nie MCP, bo referencje muszą dać się odtworzyć bez uruchomionej
 * aplikacji Figma — inaczej porównanie z makietą nie zadziała w CI ani w sesji,
 * w której Figma Desktop jest zamknięta.
 *
 * Użycie: npm run figma:ref -- <slug> [--mobile] [--scale N]
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { ROOT, readProjekt, requireFileKey, uzupelnijRamke, zapiszProjekt, OSTRZEZENIE_RAMKI } from './lib/projekt.mjs';

export const API = 'https://api.figma.com/v1';
export const NODES_PATH = resolvePath(ROOT, 'docs/figma/nodes.json');
export const REF_DIR = resolvePath(ROOT, 'docs/figma/ref');
export const FORMATS = ['png', 'jpg', 'svg', 'pdf'];

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

export function readEnvToken(env, dotenv) {
  if (env && env.FIGMA_TOKEN) {
    return env.FIGMA_TOKEN;
  }

  if (typeof dotenv === 'string') {
    for (const line of dotenv.split('\n')) {
      const match = line.match(/^\s*FIGMA_TOKEN\s*=\s*(.*)\s*$/);
      if (match) {
        const value = match[1].trim().replace(/^["']|["']$/g, '');
        if (value) {
          return value;
        }
      }
    }
  }

  throw new Error(
    'Brak FIGMA_TOKEN. Utwórz plik .env w katalogu projektu z linią:\n' +
      '  FIGMA_TOKEN=figd_...\n' +
      'Token wygenerujesz w Figmie: Settings → Security → Personal access tokens, ' +
      'zakres "File content: read". Plik .env jest w .gitignore.'
  );
}

export function readDotenv(root = ROOT) {
  const path = resolvePath(root, '.env');
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

export function resolveToken() {
  return readEnvToken(process.env, readDotenv());
}

// ---------------------------------------------------------------------------
// Identyfikatory węzłów i adresy API
// ---------------------------------------------------------------------------

export function normalizeNodeId(id) {
  // Flaga /g jest tu konieczna: identyfikatory zagnieżdżonych instancji (np.
  // "I2001-3538;2001-3150" dla węzła wewnątrz instancji) mają więcej niż jeden
  // myślnik do zamiany. Bez /g zamienia się tylko pierwszy, a URL-owa forma
  // takiego id — czyli dokładnie to, co użytkownik wkleja z adresu Figmy —
  // wychodzi uszkodzona w połowie.
  return String(id).trim().replace(/-/g, ':');
}

/**
 * Przyjmuje identyfikator węzła w dowolnej formie, w jakiej użytkownik go
 * dostaje: z adresu Figmy (`12-345`), z API/wtyczki (`12:345`) albo cały
 * link z parametrem `node-id`. Zwraca formę API.
 */
export function parseNodeArg(arg) {
  const text = String(arg).trim();
  if (/^https?:\/\//.test(text)) {
    const nodeId = new URL(text).searchParams.get('node-id');
    if (!nodeId) {
      throw new Error(`Link ${text} nie zawiera parametru node-id — zaznacz warstwę i skopiuj link ponownie.`);
    }
    return normalizeNodeId(nodeId);
  }
  if (!/^I?\d+[:-]\d+([;][I]?\d+[:-]\d+)*$/.test(text)) {
    throw new Error(`"${text}" nie wygląda na identyfikator węzła Figmy (oczekiwane np. 12-345 albo 12:345).`);
  }
  return normalizeNodeId(text);
}

export function imageUrlEndpoint(fileKey, nodeIds, opts = {}) {
  const scale = opts.scale ?? 2;
  const format = opts.format ?? 'png';

  if (!(scale >= 0.01 && scale <= 4)) {
    throw new Error(`Nieprawidłowa skala ${scale}; Figma API przyjmuje zakres 0.01–4.`);
  }
  if (!FORMATS.includes(format)) {
    throw new Error(`Nieznany format "${format}"; Figma API eksportuje: ${FORMATS.join(', ')}.`);
  }

  const params = new URLSearchParams({
    ids: nodeIds.map(normalizeNodeId).join(','),
    scale: String(scale),
    format,
  });
  for (const [key, value] of Object.entries(opts.extra ?? {})) {
    params.set(key, String(value));
  }

  return `${API}/images/${fileKey}?${params}`;
}

export function nodesEndpoint(fileKey, nodeIds, opts = {}) {
  const params = new URLSearchParams({ ids: nodeIds.map(normalizeNodeId).join(',') });
  if (opts.depth != null) {
    params.set('depth', String(opts.depth));
  }
  return `${API}/files/${fileKey}/nodes?${params}`;
}

/**
 * Dokument pliku okrojony do ścieżki od korzenia do wskazanych węzłów —
 * parametr `ids` endpointu /files zwraca właśnie przodków, czego /nodes nie robi.
 */
export function ancestorsEndpoint(fileKey, nodeId) {
  return `${API}/files/${fileKey}?${new URLSearchParams({ ids: normalizeNodeId(nodeId) })}`;
}

/**
 * Znajduje ramkę strony, w której leży węzeł: najbardziej zewnętrzną ramkę
 * (FRAME, COMPONENT, INSTANCE) na ścieżce od strony (CANVAS) do węzła.
 * Sekcje i grupy Figmy pomijamy — to organizacja płótna, nie ekran.
 * Zwraca { id, name, width } albo null, gdy węzła nie ma w drzewie.
 */
export function findPageFrame(root, nodeId) {
  const target = normalizeNodeId(nodeId);
  const FRAME_TYPES = new Set(['FRAME', 'COMPONENT', 'INSTANCE']);

  function path(node) {
    if (node.id === target) {
      return [node];
    }
    for (const child of node.children ?? []) {
      const found = path(child);
      if (found) {
        return [node, ...found];
      }
    }
    return null;
  }

  const chain = path(root);
  if (!chain) {
    return null;
  }
  const frame = chain.find((node) => FRAME_TYPES.has(node.type) && node.absoluteBoundingBox);
  if (!frame) {
    return null;
  }
  return { id: frame.id, name: frame.name, width: frame.absoluteBoundingBox.width };
}

/**
 * Tłumaczy status HTTP z Figma API na komunikat z instrukcją naprawy.
 * Surowe „403 Forbidden” nie mówi, czy winny jest token, zakres uprawnień, czy
 * plik — a to trzy różne naprawy.
 */
export function describeApiError(status, body = '') {
  const tail = body ? ` Odpowiedź: ${String(body).slice(0, 300)}` : '';
  if (status === 403) {
    return (
      'Figma API odmówiło dostępu (403): token bez dostępu do pliku albo nieważny. ' +
      'Wygeneruj nowy w Settings → Security → Personal access tokens, zakres "File content: read", ' +
      'i upewnij się, że konto tokenu widzi ten plik.' + tail
    );
  }
  if (status === 404) {
    return 'Figma API nie znalazło pliku albo węzła (404) — sprawdź figma.fileKey w projekt.json i id węzła.' + tail;
  }
  if (status === 429) {
    return 'Figma API ogranicza liczbę zapytań (429) — odczekaj minutę i spróbuj ponownie.' + tail;
  }
  return `Figma API zwróciło ${status}.` + tail;
}

async function getJson(url, token, fetchImpl = fetch) {
  const response = await fetchImpl(url, { headers: { 'X-Figma-Token': token } });
  if (!response.ok) {
    throw new Error(describeApiError(response.status, await response.text()));
  }
  const json = await response.json();
  if (json.err) {
    throw new Error(`Figma API zgłosiło błąd: ${json.err}`);
  }
  return json;
}

/**
 * Adresy wyrenderowanych obrazów: obiekt { nodeId: url | null }. `null` znaczy,
 * że Figma węzła nie wyrenderowała (pusty, niewidoczny albo o zerowym rozmiarze)
 * — o tym, czy to błąd, decyduje wywołujący.
 */
export async function fetchImageUrls(fileKey, nodeIds, opts = {}) {
  const token = opts.token ?? resolveToken();
  const { images } = await getJson(imageUrlEndpoint(fileKey, nodeIds, opts), token, opts.fetch);
  return images ?? {};
}

export async function downloadBuffer(url, fetchImpl = fetch) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Pobieranie ${url} nie powiodło się: HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Eksport ścisły — każdy węzeł musi się wyrenderować. Tak pobieramy referencje:
 * brak obrazu referencyjnego to błąd konfiguracji, nie coś do przemilczenia.
 */
export async function exportNodes(fileKey, nodeIds, opts = {}) {
  const images = await fetchImageUrls(fileKey, nodeIds, opts);
  const result = new Map();
  for (const [nodeId, url] of Object.entries(images)) {
    if (!url) {
      throw new Error(`Figma nie wyrenderowała węzła ${nodeId} — prawdopodobnie jest pusty albo niewidoczny.`);
    }
    result.set(nodeId, await downloadBuffer(url, opts.fetch));
  }
  return result;
}

/** Dokumenty węzłów: Map { nodeId -> document } (brak węzła -> brak wpisu). */
export async function fetchNodeDocuments(fileKey, nodeIds, opts = {}) {
  const token = opts.token ?? resolveToken();
  const { nodes } = await getJson(nodesEndpoint(fileKey, nodeIds, opts), token, opts.fetch);
  const result = new Map();
  for (const [nodeId, value] of Object.entries(nodes ?? {})) {
    if (value?.document) {
      result.set(nodeId, value.document);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Przycinanie referencji do ramki węzła
// ---------------------------------------------------------------------------

function unionRect(a, b) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const right = Math.max(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * Liczy sumę (union) prostokątów `absoluteBoundingBox` węzła Figmy i wszystkich
 * jego widocznych potomków — czyli to, co Figma faktycznie renderuje przy
 * eksporcie PNG węzła, niezależnie od jego własnej, deklarowanej ramki.
 *
 * Powód: eksport PNG z Figmy nie ma wymiarów węzła, gdy któreś z dzieci
 * wystaje poza jego ramkę — Figma renderuje całą „farbę” poddrzewa, nie
 * prostokąt węzła. Typowe przypadki: dekoracyjna grupa linii wyższa od sekcji
 * albo blok o sztywnej szerokości szerszy niż ramka mobilna. Porównanie
 * wymiarów przewracałoby się wtedy na geometrii, której w implementacji nie ma.
 *
 * `absoluteRenderBounds` się do tego nie nadaje: bywa mniejszy niż sama ramka
 * i nie odpowiada wymiarom eksportu.
 *
 * Węzeł niewidoczny (`visible === false`) jest pomijany razem z poddrzewem —
 * Figma go nie renderuje. Ramka z `clipsContent: true` przycina swoje dzieci,
 * więc liczy się jej własny prostokąt, a potomkowie już nie.
 */
export function sumVisibleBoundingBoxes(node) {
  const boxes = [];

  (function collect(current) {
    if (current.visible === false) {
      return;
    }
    if (current.absoluteBoundingBox) {
      boxes.push(current.absoluteBoundingBox);
      if (current.clipsContent === true) {
        return;
      }
    }
    for (const child of current.children ?? []) {
      collect(child);
    }
  })(node);

  if (boxes.length === 0) {
    throw new Error('Węzeł nie ma żadnego widocznego prostokąta — nie da się policzyć sumy.');
  }

  return boxes.reduce(unionRect);
}

/**
 * Przesunięcie, o jakie trzeba przyciąć eksport PNG, żeby dostać ramkę węzła
 * (bbox) zamiast sumy (union) widocznych potomków. Nadmiar może wystawać
 * w dowolną stronę — również w lewo i w górę — więc przesunięcie liczy się
 * osobno dla obu osi. Union zawsze zawiera bbox, więc obie wartości są nieujemne.
 */
export function computeCropOffset(bbox, union) {
  return { x: bbox.x - union.x, y: bbox.y - union.y };
}

const near = (a, b) => Math.abs(a - b) <= 1;

/**
 * Decyduje, czy referencję (eksport w skali 1) trzeba przyciąć do ramki węzła.
 *
 *  - `zgodny`: PNG ma wymiary ramki — nic do przycinania;
 *  - `przyciecie`: PNG ma wymiary sumy potomków — zwraca prostokąt przycięcia;
 *  - `nieznany`: PNG nie pasuje ani do ramki, ani do sumy (np. cień poza
 *    ramką). Wtedy NIE zgadujemy — lepiej zgłosić rozjazd wymiarów niż
 *    porównywać źle wycięty fragment.
 *
 * Tolerancja 1 px, bo Figma trzyma współrzędne ułamkowe, a PNG ma całe piksele.
 */
export function planReferenceCrop(document, pngWidth, pngHeight) {
  const bbox = document.absoluteBoundingBox;
  if (!bbox) {
    return { status: 'nieznany', message: 'Węzeł nie ma absoluteBoundingBox.' };
  }

  if (near(pngWidth, bbox.width) && near(pngHeight, bbox.height)) {
    return { status: 'zgodny' };
  }

  const union = sumVisibleBoundingBoxes(document);
  if (near(pngWidth, union.width) && near(pngHeight, union.height)) {
    const offset = computeCropOffset(bbox, union);
    const x = Math.max(0, Math.round(offset.x));
    const y = Math.max(0, Math.round(offset.y));
    return {
      status: 'przyciecie',
      crop: {
        x,
        y,
        width: Math.min(Math.round(bbox.width), pngWidth - x),
        height: Math.min(Math.round(bbox.height), pngHeight - y),
      },
    };
  }

  return {
    status: 'nieznany',
    message:
      `Eksport ${pngWidth}x${pngHeight} nie odpowiada ani ramce węzła ` +
      `${Math.round(bbox.width)}x${Math.round(bbox.height)}, ani sumie potomków ` +
      `${Math.round(union.width)}x${Math.round(union.height)} (np. cień albo efekt poza ramką).`,
  };
}

// ---------------------------------------------------------------------------
// nodes.json i referencje
// ---------------------------------------------------------------------------

export function readNodes(path = NODES_PATH) {
  if (!existsSync(path)) {
    return {};
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function writeNodes(nodes, path = NODES_PATH) {
  writeFileSync(path, `${JSON.stringify(nodes, null, 2)}\n`, 'utf8');
}

export function refPath(slug, breakpoint, scale = 1) {
  const suffix = scale === 1 ? '' : `@${scale}x`;
  return resolvePath(REF_DIR, `${slug}.${breakpoint}${suffix}.png`);
}

/**
 * Pobiera referencję sekcji w skali 1 i od razu ustala, czy trzeba ją przycinać
 * do ramki węzła. Wynik trafia do nodes.json jako pole `crop` — żeby porównanie
 * nie musiało przy każdym uruchomieniu pobierać pełnego drzewa węzła z API.
 * Brak pola `crop` oznacza „eksport ma wymiary ramki”.
 *
 * Z przekazanym `projekt` uzupełnia też brakujące figma.ramki (patrz fillFrameWidth).
 */
export async function downloadReference({
  slug,
  breakpoint,
  nodes,
  fileKey,
  token,
  projekt = null,
  save = zapiszProjekt,
  log = console.log,
  warn = console.warn,
}) {
  const nodeId = nodes[slug]?.[breakpoint];
  if (!nodeId) {
    throw new Error(`Slug "${slug}" nie ma węzła dla breakpointu "${breakpoint}" w docs/figma/nodes.json.`);
  }

  const images = await exportNodes(fileKey, [nodeId], { scale: 1, token });
  const buffer = images.values().next().value;
  const path = refPath(slug, breakpoint);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buffer);
  log(`Zapisano referencję ${path} (${Math.round(buffer.length / 1024)} kB).`);

  try {
    const png = PNG.sync.read(buffer);
    const documents = await fetchNodeDocuments(fileKey, [nodeId], { token });
    const document = documents.get(normalizeNodeId(nodeId));
    if (!document) {
      warn(`Nie udało się pobrać drzewa węzła ${nodeId} — pomijam wyliczenie przycięcia.`);
      return path;
    }

    const plan = planReferenceCrop(document, png.width, png.height);
    const entry = nodes[slug];
    const hadCrop = Boolean(entry.crop?.[breakpoint]);

    if (plan.status === 'przyciecie') {
      entry.crop = { ...(entry.crop ?? {}), [breakpoint]: plan.crop };
      writeNodes(nodes);
      log(
        `Eksport ${png.width}x${png.height} jest większy niż ramka węzła — coś wystaje poza nią w makiecie. ` +
          `Zapisano crop.${breakpoint} = ${JSON.stringify(plan.crop)} w nodes.json.`
      );
    } else if (hadCrop) {
      // Makieta się zmieniła albo przycięcie było wpisane ręcznie i jest nieaktualne —
      // stary prostokąt mógłby wyciąć zły fragment nowego eksportu.
      delete entry.crop[breakpoint];
      if (Object.keys(entry.crop).length === 0) {
        delete entry.crop;
      }
      writeNodes(nodes);
      log(`Usunięto nieaktualne crop.${breakpoint} z nodes.json.`);
    }

    if (plan.status === 'nieznany') {
      warn(`OSTRZEŻENIE: ${plan.message} Przycięcie trzeba ustalić ręcznie (pole "crop" w nodes.json).`);
    }
  } catch (error) {
    warn(`Nie udało się wyliczyć przycięcia referencji: ${error.message}`);
  }

  if (projekt) {
    await fillFrameWidth({ projekt, breakpoint, nodeId, fileKey, token, log, warn, save });
  }

  return path;
}

/**
 * Gdy projekt.json nie ma jeszcze figma.ramki dla breakpointu, ustala szerokość
 * ramki strony, w której leży węzeł sekcji, i zapisuje ją. Porównanie musi
 * odbywać się przy szerokości tej ramki, a pierwsze pobranie referencji to
 * naturalny moment, żeby ją poznać bez ręcznego mierzenia. Istniejącej
 * wartości nie nadpisuje. Niepowodzenie to ostrzeżenie, nie błąd.
 */
async function fillFrameWidth({ projekt, breakpoint, nodeId, fileKey, token, log, warn, save }) {
  const klucz = breakpoint === 'mobile' ? 'mobile' : 'desktop';
  if (Number.isFinite(projekt.figma?.ramki?.[klucz])) {
    return;
  }
  try {
    const { document } = await getJson(ancestorsEndpoint(fileKey, nodeId), token);
    const frame = findPageFrame(document, nodeId);
    const updated = frame ? uzupelnijRamke(projekt, klucz, frame.width) : null;
    if (!updated) {
      warn(`OSTRZEŻENIE: nie udało się ustalić ramki strony dla węzła ${nodeId} — ${OSTRZEZENIE_RAMKI}.`);
      return;
    }
    save(updated);
    Object.assign(projekt, updated);
    log(
      `Uzupełniono figma.ramki.${klucz} = ${updated.figma.ramki[klucz]} w projekt.json ` +
        `(ramka „${frame.name}” ${frame.id}). Sprawdź, czy to ramka strony, a nie komponentu.`
    );
  } catch (error) {
    warn(`OSTRZEŻENIE: nie udało się ustalić ramki strony (${error.message}) — ${OSTRZEZENIE_RAMKI}.`);
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const HELP = `Pobiera referencję sekcji z Figmy do docs/figma/ref/.

Użycie: npm run figma:ref -- <slug> [--mobile] [--scale N]

  <slug>     klucz z docs/figma/nodes.json, np. home-hero
  --mobile   węzeł mobilny zamiast desktopowego
  --scale N  skala eksportu (domyślnie 1 — tylko taką referencję czyta parity;
             inna skala zapisuje osobny plik <slug>.<bp>@Nx.png do podglądu)`;

async function main() {
  const [slug, ...flags] = process.argv.slice(2);
  if (!slug || slug === '--help' || slug === '-h') {
    console.log(HELP);
    process.exitCode = slug ? 0 : 1;
    return;
  }

  const breakpoint = flags.includes('--mobile') ? 'mobile' : 'desktop';
  const scaleIndex = flags.indexOf('--scale');
  const scale = scaleIndex > -1 ? Number(flags[scaleIndex + 1]) : 1;

  const nodes = readNodes();
  const entry = nodes[slug];
  if (!entry) {
    throw new Error(`Nie znam sluga "${slug}". Dostępne w nodes.json: ${Object.keys(nodes).join(', ') || '(brak)'}`);
  }
  if (!entry[breakpoint]) {
    if (breakpoint === 'mobile') {
      console.log(`Slug "${slug}" nie ma makiety mobilnej (mobile: null) — wersja mobilna jest projektowana, nie ma czego pobrać.`);
      return;
    }
    throw new Error(`Slug "${slug}" nie ma węzła dla breakpointu "${breakpoint}".`);
  }

  const projekt = readProjekt();
  const fileKey = requireFileKey(projekt);
  const token = resolveToken();

  if (scale === 1) {
    await downloadReference({ slug, breakpoint, nodes, fileKey, token, projekt });
    return;
  }

  const images = await exportNodes(fileKey, [entry[breakpoint]], { scale, token });
  const buffer = images.values().next().value;
  const out = refPath(slug, breakpoint, scale);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buffer);
  console.log(`Zapisano ${out} (${Math.round(buffer.length / 1024)} kB) — podgląd, parity używa skali 1.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
