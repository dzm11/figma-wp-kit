# Brief dla subagenta: sekcja home-{slug}

> Koordynator wypełnia pola w nawiasach klamrowych i wkleja pod spodem
> **pełny kontrakt sekcji** oraz, gdy mobile jest do zaprojektowania,
> treść `mobile.md`.

Budujesz jedną sekcję strony `{widok}` motywu WordPress `{slug}` (prefiks
`{prefiks}`). Katalog projektu: `{sciezka}`. Pracujesz po polsku: komentarze
w kodzie i raport.

## Twoje pliki, i tylko te

    theme/template-parts/sections/home-{slug}.php
    theme/assets/css/sections/home-{slug}.css
    {theme/assets/js/{nazwa}.js — tylko jeśli kontrakt ma interakcję}

Nic poza nimi. Nagłówek, stopka, `inc/`, `functions.php`, `tools/` i inne
sekcje są w rękach innych. Brakuje ci czegoś we wspólnym pliku (token,
helper, ikona w sprite)? Napisz to w raporcie, nie dopisuj sam.

Partial jest już wołany przez `{prefiks}_render_home_sections()`. Styl ładujesz
pierwszą linią partiala po `defined( 'ABSPATH' ) || exit;`:
`{prefiks}_enqueue_section_style( 'home-{slug}' );`

Wzorzec do naśladowania: `theme/template-parts/sections/home-{wzorcowa}.php`.

## Co robisz

1. **Przeczytaj kontrakt poniżej.** Liczby w nim są zmierzone. **Nie zgaduj
   ani jednej liczby.** Brakuje wartości? Odczytaj ją z Figmy: przez MCP
   `figma-console` (plik `{fileKey}`, węzeł z kontraktu) albo REST API
   z tokenem z `.env`. Jeśli się nie da, zgłoś to w raporcie.
2. **Markup i style.** Treść z makiety wstawiasz jako wartość domyślną,
   z polem CMS jako nadpisaniem:
   `$tytul = get_field( 'home_{slug}_title' ) ?: __( 'Tekst z makiety', '{slug}' );`
   Grup pól SCF **nie definiujesz**, to późniejsza faza.
3. **Komponenty współdzielone** (przycisk, karta, ikona) bierzesz z
   `theme/template-parts/components/`. Nie kopiujesz ich stylów do sekcji.
4. **Obejrzyj wynik.** `http://localhost:8888/`: zrzut sekcji w szerokości ramek z `projekt.json` (`figma.ramki`, zwykle desktop i 393),
   **spójrz na niego**, porównaj z `docs/figma/ref/home-{slug}*.png` i popraw
   to, co odstaje.
5. **Zmierz geometrię** (Playwright, `boundingBox`) kluczowych elementów
   z tabeli wymiarów. Rozjazd > 4 px poprawiasz albo wyjaśniasz.
6. `npm run parity -- home-{slug}`, a przy makiecie mobilnej także `--mobile`.
7. Sprawdź brak poziomego scrolla na 393, 1024, 1440 i 1920.

## Czego nie robisz

- Nie piszesz testów e2e i nie uruchamiasz `npm run test:e2e`.
- Nie definiujesz pól SCF.
- Nie uruchamiasz poleceń git zmieniających stan (`add`, `commit`, `checkout`,
  `stash`, `reset`, `clean`). `status`, `diff` i `log` wolno.
- Nie dispatchujesz podagentów.
- Nie odtwarzasz sztywnych szerokości z Figmy, które nie mieszczą się
  w breakpoincie (np. blok 728 px w ramce 393). Pozwól treści płynąć
  i napisz o tym.

## Konwencje

- **Wyłącznie tokeny semantyczne** z `theme/assets/css/tokens.css`. Zero hexów,
  zero `!important`.
- Klasy `.{prefiks}-{slug}__element`, modyfikatory `--wariant`.
- Mobile-first, `min-width`. Breakpointy z `projekt.json.szerokosciTestowe`.
- Siatka: `.{prefiks}-container` **albo** `.{prefiks}-wrapper`, nigdy jedno
  w drugim. Tło pełnej szerokości na elemencie `<section>`, nie na wrapperze.
- Escapowanie: `esc_html`, `esc_attr`, `esc_url`, `wp_kses_post`. Teksty przez
  `__()` z domeną `'{slug}'`.
- Każdy `<img>` ma `width` i `height`. Dekoracje mają `aria-hidden="true"`.
- Animacje respektują `prefers-reduced-motion`.

## Pułapki, na których już się przewracaliśmy

- Element `position: absolute` liczy `inset` od krawędzi **paddingu** rodzica,
  nie treści. Dekoracja przesunęła się przez to o 110 px.
- Blok o zadanej wysokości z treścią, która się zawija, po cichu rozpycha
  układ. Nagłówek urósł ze 184 do 250 px i żaden test tego nie zauważył.
- Tekst w pasku o zadanej wysokości nie centruje się sam.
- Potomek z `z-index: -1` ucieka za tło rodzica, jeśli rodzic nie tworzy
  kontekstu stosu. Lekarstwo: `isolation: isolate` na rodzicu.
- Klikalny element przykryty dekoracją ma martwą strefę. Dekoracja dostaje
  `pointer-events: none`.
- `overflow-x: clip` na `html` **ukrywa** poziomy scroll zamiast go usuwać.
  Ucięty przycisk nie da o sobie znać. Mierz `scrollWidth` elementów, nie strony.

## Raport (zwięźle)

- Pliki.
- Tabela: element | Figma | przeglądarka | rozjazd, dla kluczowych wymiarów
  na desktopie i mobile.
- Wynik parity (liczby).
- Czego brakowało we wspólnych plikach.
- Rozbieżności, których nie naprawiłeś, z powodem.
- Przy mobile do zaprojektowania: lista decyzji w formacie do wklejenia
  do rejestru.

---

## Kontrakt sekcji

{wklejony kontrakt}
