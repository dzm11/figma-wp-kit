/**
 * Jedno miejsce odczytu projekt.json — konfiguracji, która odróżnia jeden projekt
 * klienta od drugiego (klucz pliku Figmy, adres lokalnego WordPressa, szerokości
 * testowe). Narzędzia nie mają zaszytych wartości klienta: wszystko, co zależy
 * od projektu, a nie jest prefiksem, czytają stąd w czasie działania.
 *
 * Moduł nie czyta pliku przy imporcie — robią to dopiero funkcje. Dzięki temu
 * testy jednostkowe mogą importować narzędzia bez skonfigurowanego projektu.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PROJEKT_PATH = resolvePath(ROOT, 'projekt.json');

// Wysokości viewportów nie są częścią kontraktu projektu: zrzut sekcji obejmuje
// cały element niezależnie od wysokości okna, więc wysokość wpływa tylko na to,
// co jest „nad zgięciem” (np. elementy przyklejone). Wartości odpowiadają
// typowym urządzeniom danej klasy — 852 to wysokość ekranu telefonu o szerokości
// 393, 1080 to Full HD.
export const WYSOKOSCI_VIEWPORTU = { mobile: 852, tablet: 900, desktop: 900, wide: 1080 };

export function readProjekt(path = PROJEKT_PATH) {
  if (!existsSync(path)) {
    throw new Error(`Brak pliku ${path}. Zestaw startowy wymaga projekt.json w katalogu głównym.`);
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(`Nie da się odczytać ${path}: ${error.message}`);
  }
}

/**
 * Klucz pliku Figmy albo czytelny błąd. Pusty klucz oznacza, że projekt nie
 * przeszedł jeszcze konfiguracji — każde zapytanie do API skończyłoby się 404,
 * które nic by użytkownikowi nie powiedziało.
 */
export function requireFileKey(projekt) {
  const key = projekt?.figma?.fileKey;
  if (!key || !String(key).trim()) {
    throw new Error(
      'Brak figma.fileKey w projekt.json — projekt nie jest skonfigurowany. Uruchom npm run setup.'
    );
  }
  return String(key).trim();
}

/** Adres lokalnego WordPressa, zawsze z końcowym ukośnikiem. */
export function baseUrl(projekt) {
  const url = projekt?.urlLokalny;
  if (!url) {
    throw new Error('Brak urlLokalny w projekt.json. Uruchom npm run setup.');
  }
  return String(url).endsWith('/') ? String(url) : `${url}/`;
}

/** Szerokość testowa danego zakresu z projekt.json.szerokosciTestowe. */
export function szerokosc(projekt, zakres) {
  const value = projekt?.szerokosciTestowe?.[zakres];
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      `Brak poprawnej szerokości "${zakres}" w projekt.json.szerokosciTestowe (jest: ${value}).`
    );
  }
  return value;
}

/** Viewport {width, height} dla zakresu testowego (mobile/tablet/desktop/wide). */
export function viewportZakresu(projekt, zakres) {
  return { width: szerokosc(projekt, zakres), height: WYSOKOSCI_VIEWPORTU[zakres] ?? 900 };
}

export const OSTRZEZENIE_RAMKI = 'uzupełnij figma.ramki w projekt.json (faza rekonesansu)';

/**
 * Szerokość ramki strony w Figmie dla breakpointu porównania.
 *
 * Porównanie z makietą ma sens tylko przy tej samej szerokości viewportu, na
 * jakiej projektant narysował ramkę — inaczej układ płynny ułoży się inaczej
 * i każda sekcja różniłaby się od makiety szerokością. Ramki bywają różne
 * (desktop 1920, 1440, 1280; mobile 393, 375, 360), a szerokości testowe e2e
 * to osobna sprawa, więc szerokość porównania ma własne pole: figma.ramki.
 *
 * Brak pola to nie błąd, tylko stan przed rekonesansem: spadamy wtedy na
 * szerokość testową (`wide` dla desktopu, `mobile` dla mobile) i zwracamy
 * `brakRamki`, żeby wywołujący mógł ostrzec.
 */
export function ramkaPorownania(projekt, breakpoint) {
  const klucz = breakpoint === 'mobile' ? 'mobile' : 'desktop';
  const width = projekt?.figma?.ramki?.[klucz];
  if (Number.isFinite(width) && width > 0) {
    return { width, brakRamki: false };
  }
  return { width: szerokosc(projekt, klucz === 'mobile' ? 'mobile' : 'wide'), brakRamki: true };
}

/**
 * Viewport porównania sekcji z makietą: szerokość ramki z figma.ramki (albo
 * zapasowo szerokość testowa, z ostrzeżeniem), wysokość typowa dla klasy
 * urządzenia.
 */
export function viewportPorownania(projekt, breakpoint, warn = console.warn) {
  const { width, brakRamki } = ramkaPorownania(projekt, breakpoint);
  if (brakRamki) {
    const klucz = breakpoint === 'mobile' ? 'mobile' : 'desktop';
    warn(
      `OSTRZEŻENIE: brak figma.ramki.${klucz} — porównuję przy szerokości ${width} px ` +
        `z szerokosciTestowe; ${OSTRZEZENIE_RAMKI}.`
    );
  }
  return { width, height: WYSOKOSCI_VIEWPORTU[breakpoint === 'mobile' ? 'mobile' : 'wide'] };
}

/**
 * Zwraca kopię projektu z uzupełnioną szerokością ramki albo null, gdy nie ma
 * czego zmieniać (pole już ustawione albo szerokość niepoprawna). Istniejącej
 * wartości nigdy nie nadpisuje — ustawienie ręczne ma pierwszeństwo.
 */
export function uzupelnijRamke(projekt, breakpoint, width) {
  const klucz = breakpoint === 'mobile' ? 'mobile' : 'desktop';
  if (!Number.isFinite(width) || width <= 0) {
    return null;
  }
  if (Number.isFinite(projekt?.figma?.ramki?.[klucz])) {
    return null;
  }
  return {
    ...projekt,
    figma: {
      ...(projekt.figma ?? {}),
      ramki: { ...(projekt.figma?.ramki ?? {}), [klucz]: Math.round(width) },
    },
  };
}

export function zapiszProjekt(projekt, path = PROJEKT_PATH) {
  writeFileSync(path, `${JSON.stringify(projekt, null, 2)}\n`, 'utf8');
}
