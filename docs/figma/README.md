# docs/figma — dane wyciągnięte z makiety

Ten katalog jest pomostem między Figmą a kodem. Leżą tu dane, których skrypty
nie potrafią pobrać same (tokeny wymagają MCP `figma-console`, a MCP żyje
w sesji Claude, nie w skrypcie), oraz mapa sekcji strony na węzły makiety.

| Plik / katalog | Kto pisze | Kto czyta |
|---|---|---|
| `tokens.json` | agent przez MCP `figma-console` | `npm run tokens`, `npm run fonts` |
| `nodes.json` | agent albo człowiek; pole `crop` dopisuje `npm run figma:ref` | `npm run parity`, `npm run figma:ref` |
| `ref/` | `npm run figma:ref` i `npm run parity` (PNG są w `.gitignore`) | `npm run parity` |
| `design-assets/raw/` (katalog główny repo) | `npm run figma:assets` | `npm run images` |
| `sections/` | agent — kontrakt sekcji: wymiary, tokeny, kryteria akceptacji | ludzie i agenci budujący sekcję |

Oba pliki JSON w repozytorium są szablonami: `tokens.json` ma po jednym
przykładowym wpisie w każdej kategorii (żeby `npm run tokens` działał od
pierwszego dnia), `nodes.json` jest pusty. Po wyciągnięciu danych z makiety
zastąp przykłady w całości.

## tokens.json

Źródło prawdy dla `theme/assets/css/tokens.css`. CSS jest **generowany**
(`npm run tokens`) — nie edytuj go ręcznie, zmieniaj `tokens.json`.

```json
{
  "meta": { "fileKey": "", "generatedAt": "", "page": "" },
  "primitives": [ { "name": "Neutral/950", "hex": "#0a0a0a" } ],
  "semantic":   [ { "name": "text/primary", "alias": "Neutral/950", "hex": "#0a0a0a" } ],
  "fonts":      { "body": "Inter" },
  "typography": [ { "name": "Text md/Regular", "family": "Inter", "weight": 400,
                    "size": 16, "lineHeight": 1.5, "letterSpacing": 0 } ],
  "layout":     { "container": 1280, "gutter": 24, "wrapper": 1440, "space": [16] }
}
```

### meta

- `fileKey` — klucz pliku Figmy (ten sam co w `projekt.json`), `page` — nazwa
  strony w pliku, z której wyciągano dane.
- `generatedAt` — znacznik czasu ekstrakcji (ISO 8601). Trafia do nagłówka
  `tokens.css`; pusty oznacza szablon.

### primitives — kolory bazowe

Zmienne z kolekcji prymitywów w Figmie (np. `Blue/600`). `name` jak w Figmie,
`hex` jako `#rrggbb` albo `#rrggbbaa` (z przezroczystością).
Generują `--fwp-blue-600`. **W kodzie sekcji nie używaj prymitywów** — istnieją
tylko po to, żeby było do czego aliasować.

### semantic — kolory semantyczne

Zmienne z kolekcji semantycznej (np. `bg/brand`, `text/primary`, `border/brand`).
Jeśli zmienna w Figmie jest aliasem prymitywu, wpisz jego nazwę w `alias` —
w CSS zostanie aliasem: `--fwp-bg-brand: var(--fwp-blue-600);`, a nie
skopiowanym heksem. `hex` to wartość rozwiązana (dla czytelności i dla zmiennych
bez aliasu, wtedy `"alias": null`). Alias do nieistniejącego prymitywu to błąd.

Motyw bazowy odwołuje się m.in. do `bg/default`, `text/primary` i `border/brand` —
warto mieć te nazwy (albo zmienić odwołania w `theme/assets/css/base.css`).

### fonts — role krojów (opcjonalne)

`{ "rola": "Nazwa kroju" }`, np. `{ "body": "Inter", "heading": "Instrument Sans" }`.
Generuje `--fwp-font-family-body: var(--fwp-font-family-inter);`. Motyw używa ról
`body` i `heading`, dzięki czemu zmiana pisma to zmiana jednego wpisu. Krój
musi występować w którymś stylu `typography`.

### typography — style tekstu

Style tekstowe z Figmy. Na jeden wariant wagowy jeden wpis:

- `name` — nazwa stylu z Figmy; część po ostatnim `/` to waga
  (`Heading xl/Semibold` → klucz `heading-xl`),
- `family`, `weight` (liczba 100–900), `size` (px),
- `lineHeight` — **mnożnik**, nie piksele: interlinia z Figmy / rozmiar.
  Podaj z dokładnością co najmniej 6 miejsc (20/14 = `1.428571`, nie `1.429`) —
  generator ostrzeże, jeśli rozmiar × mnożnik nie domyka się do pełnego piksela,
- `letterSpacing` — w **em** (procent z Figmy / 100; `-2%` → `-0.02`),
- `fallback` (opcjonalnie) — krój generyczny po przecinku, domyślnie `sans-serif`.

Generuje `--fwp-t-{klucz}-size|lh|ls|family`. Styl z jednym wariantem dostaje
też `--fwp-t-{klucz}-weight`. Styl z kilkoma wariantami wagowymi (`Text sm/Regular`,
`Text sm/Bold`…) dostaje geometrię raz, a wagę wybiera się w miejscu użycia przez
współdzielone `--fwp-font-regular|medium|semibold|bold|…`. Warianty jednego stylu
muszą mieć identyczny rozmiar, interlinię, rozstrzelenie i krój — inaczej
generator przerywa z błędem.

### layout — siatka i odstępy

- `wrapper` — szerokość ramki strony (np. `Page wrapper` w makiecie), px,
- `container` — szerokość kontenera treści wewnątrz ramki, px,
- `gutter` — margines ramki od krawędzi ekranu na desktopie, px,
- `space` — lista wartości odstępów w px (z auto layoutu i zmiennych spacing);
  generuje `--fwp-space-{n}` w rem.

## nodes.json

Mapa: slug sekcji → węzły makiety. Slug to ta sama nazwa co w plikach sekcji
(`home-hero` → `template-parts/sections/home-hero.php`).

```json
{
  "home-hero": {
    "desktop": "12:345",
    "mobile": "12:678",
    "area": { "selector": ".fwp-container" }
  },
  "home-news": {
    "desktop": "34:100",
    "mobile": null,
    "area": { "selector": ".fwp-wrapper", "mobile": null }
  },
  "site-footer": {
    "desktop": "56:200",
    "mobile": "56:300",
    "selector": ".fwp-footer",
    "crop": { "desktop": { "x": 0, "y": 0, "width": 1820, "height": 1024 } }
  }
}
```

### desktop / mobile

Identyfikatory węzłów — ramek sekcji w makiecie desktopowej i mobilnej. Skąd je
wziąć: w Figmie zaznacz ramkę → prawy przycisk → *Copy link to selection*;
parametr `node-id=12-345` z linku to identyfikator (forma z myślnikiem
i z dwukropkiem są równoważne). Z MCP: `id` węzła z `figma_get_selection`.

`"mobile": null` jest **dozwolone i normalne** — makieta nie zawsze ma wersję
mobilną każdej sekcji. Wtedy `npm run parity -- <slug> --mobile` nie porównuje
niczego, tylko sprawdza, że sekcja jest na stronie, zapisuje jej zrzut
(`ref/<slug>.mobile.actual.png`) do obejrzenia i kończy się kodem 0. Brak sekcji
na stronie nadal daje kod 1.

`desktop` jest wymagany.

### Szerokość porównania — `figma.ramki` w projekt.json

Porównanie ma sens tylko przy szerokości viewportu równej szerokości ramki strony
w makiecie. Tę szerokość trzyma `projekt.json`:

```json
"figma": { "ramki": { "desktop": 1440, "mobile": 375 } }
```

To pole jest niezależne od `szerokosciTestowe` (szerokości testów e2e): makieta
bywa rysowana na 1440 albo 1280, a e2e i tak sprawdza cztery zakresy.
Pierwsze `npm run figma:ref` (albo parity pobierające brakującą referencję)
uzupełnia brakującą wartość samo — z szerokości najbardziej zewnętrznej ramki,
w której leży węzeł sekcji — i wypisuje, którą ramkę wzięło. Ręcznie wpisana
wartość nigdy nie jest nadpisywana. Dopóki pola brak, parity porównuje przy
`szerokosciTestowe.wide` / `.mobile` i ostrzega: „uzupełnij figma.ramki
w projekt.json (faza rekonesansu)”.

### selector

Selektor elementu sekcji na stronie. Dla slugów `home-*` można go pominąć —
wyprowadza się sam: `home-hero` → `.fwp-hero`. Wpisz go dla elementów, które
nie są sekcjami strony głównej (nagłówek, stopka, pasek ogłoszeń).

### area — obszar porównania

Węzeł w Figmie zwykle mierzy warstwę treści (wrapper albo kontener), a element
sekcji na stronie ma pełną szerokość ekranu, bo tło rozciąga się od krawędzi
do krawędzi. Bez `area` porównanie szerokości przewracałoby się na każdej takiej
sekcji. `area.selector` wskazuje element wewnątrz sekcji, do którego zrzut jest
przycinany **w poziomie** (wysokość nigdy — różnica wysokości to prawdziwy sygnał).

Jak dobrać: porównaj szerokość węzła w Figmie z warstwami siatki — węzeł
szerokości `wrapper` → `.fwp-wrapper`, szerokości `container` → `.fwp-container`,
szerokości całej ramki strony → pomiń `area`. Klucz `mobile` / `desktop` wewnątrz
`area` nadpisuje ustawienie dla jednego breakpointu (`null` = bez przycinania) —
na mobile węzeł często ma szerokość ekranu, a kontener jest węższy.

Gdy sekcja nie zawiera wskazanego elementu, parity wyśrodkowuje obszar o szerokości
referencji i wypisuje „UŻYTO WARIANTU ZAPASOWEGO”.

### crop — przycięcie referencji

Eksport PNG z Figmy bywa **większy niż ramka węzła**, gdy coś wystaje poza nią
(dekoracyjna grupa, blok o sztywnej szerokości) — Figma renderuje całe poddrzewo.
`npm run figma:ref` (i parity przy pierwszym pobraniu referencji) wylicza to samo:
porównuje wymiary PNG z ramką węzła i z sumą ramek widocznych potomków, a gdy
eksport ma nadmiar, zapisuje tu prostokąt ramki w układzie eksportu. Ręcznie
wpisuj tylko wtedy, gdy narzędzie zgłosi, że nie umie ustalić przycięcia
(np. cień poza ramką). Po zmianie makiety pobierz referencję ponownie — nieaktualne
`crop` zostanie usunięte albo przeliczone.

### Wpisy pomocnicze

Slug bez `home-` i bez `selector` (np. `_page` z ramką całej strony albo
`asset-*` z pojedynczą grafiką) jest dozwolony — służy do `npm run figma:ref`,
parity go odrzuci.

## Kolejność pracy

1. `npm run sprawdz` — środowisko, token, Docker, WordPress.
2. Agent wyciąga zmienne i style przez MCP do `tokens.json` → `npm run tokens`
   → `npm run fonts` (kroje z Google Fonts do `theme/assets/fonts/` i `fonts.css`).
3. Wpisy sekcji w `nodes.json` → `npm run figma:ref -- <slug>` (i `--mobile`);
   pierwsze pobranie uzupełnia `figma.ramki` w `projekt.json`.
4. Grafiki: `npm run figma:assets -- <nodeId...> --format svg|png|jpg` zapisuje
   surowe eksporty do `design-assets/raw/` — poza motywem, żeby nie trafiły na
   serwer — a `npm run images` robi z nich WebP + oryginał w `theme/assets/img/`.
5. Budowa sekcji → `npm run parity -- <slug>` i `npm run parity -- <slug> --mobile`.
   Progi: rozjazd geometrii > 4 px albo różnica pikseli > 2 % poza maskami tekstu
   to kod 1. Progów się nie luzuje.
