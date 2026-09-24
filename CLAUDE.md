# CLAUDE.md

Ten plik prowadzi Claude Code przez przeniesienie strony zaprojektowanej w Figmie
do WordPressa jako dedykowany motyw klasyczny (PHP + Secure Custom Fields).

Pracujemy po polsku: odpowiedzi, komentarze w kodzie, commity.

Dane projektu (klient, prefiks, slug motywu, plik Figmy) są w `projekt.json`.
Jeśli `skonfigurowany` ma wartość `false`, zacznij od `/kit-start`.

## Zasada nadrzędna

**Szybko do strony, która wygląda jak makieta, a dopiero potem reszta.**
Kolejność: wygląd → uwagi właściciela → CMS → testy → wdrożenie. Ta kolejność
wynika z doświadczenia, nie z gustu (zob. `LEKCJE.md`). Nie wracaj do TDD dla
wyglądu i nie pisz testów e2e w trakcie budowy sekcji.

Dokładność mierzysz geometrią i zrzutem ekranu, nie testami deklaracji CSS.
Żadnej wady wyglądu w dotychczasowych projektach nie znalazł test. Wszystkie
znalazł pomiar wobec makiety albo spojrzenie na zrzut.

## Gdzie jesteśmy

`docs/stan.md` mówi, która faza jest zrobiona i co dalej. **Po utracie kontekstu
ufaj `docs/stan.md`, `docs/decyzje/rejestr.md` i `git log`, nie własnej pamięci.**
Po każdej fazie aktualizujesz `docs/stan.md` i commitujesz.

`/kit` czyta stan i mówi, od czego zacząć.

## Fazy

Zawsze zaczynamy od **strony głównej**. Każda faza ma swój skill z instrukcją.

| # | Faza | Skill | Bramka: Claude zatrzymuje się i pyta |
|---|---|---|---|
| 0 | Start: konfiguracja, Figma Bridge, token API, WordPress | `/kit-start` | tak, gdy czegoś brakuje |
| 1 | Porządki w Figmie: nazwy warstw, adnotacje, komponenty, audyt | `/kit-figma-porzadki` | **tak, przed pierwszą zmianą w pliku** |
| 2 | Rekonesans: tokeny, inwentarz, kontrakty sekcji, grafiki, pytania | `/kit-rekonesans` | **tak: plan sekcji i pytania** |
| 3 | Fundament: siatka, typografia, sekcja wzorcowa, `/init` | `/kit-fundament` | nie |
| 4 | Szkic całości: wszystkie sekcje równolegle, mobile | `/kit-sekcje` | **tak: przegląd** |
| 5 | Uwagi: pasek Agentation, realizacja partiami | `/kit-uwagi` | po każdej partii |
| 6 | CMS: pola SCF, typy treści, strona ustawień | `/kit-cms` | nie |
| 7 | Testy: interakcje, porównanie na 4 szerokościach | `/kit-testy` | nie |
| 8 | Wdrożenie podglądu, blokada robotów | `/kit-wdrozenie` | **tak: przed importem bazy** |
| 9 | Lekcje do frameworka | `/kit-lekcje` | tak: zatwierdzenie zmian w zestawie |

Kolejny widok (podstrona) to ponownie fazy 2, 4, 5, 6, 7 i 8, już na gotowym
fundamencie. Uruchamia je `/kit` z nazwą widoku.

Poza bramkami pracujesz bez przerw i bez pytania o zgodę na rzeczy już ustalone
w tym pliku.

## Skille, z których korzystasz

- **superpowers**:
  - `brainstorming` w fazie 2, do zakresu i modelu treści (raz na widok, nie na sekcję),
  - `dispatching-parallel-agents` w fazach 4 i 5,
  - `systematic-debugging` przy każdym błędzie,
  - `verification-before-completion` przed ogłoszeniem, że coś działa,
  - `requesting-code-review` tylko dla kodu z JavaScriptem i interakcjami,
  - `finishing-a-development-branch` na koniec widoku.

  **Nie** używaj `writing-plans` do sekcji: planem są kontrakty sekcji
  z pomiaru. Plan pisany przed pomiarem mylił się w każdej sekcji.
- **frontend-design** przy każdej decyzji wizualnej, której makieta nie
  rozstrzyga, przede wszystkim przy projektowaniu mobile bez makiety.
- **Skille WordPressa** (`WordPress/agent-skills`), jeśli są zainstalowane:
  - `wp-plugin-development` do hooków, bezpieczeństwa i escapowania,
  - `wp-project-triage` przy diagnozie środowiska.

  Instalacja jest w `/kit-start`.
- **MCP `figma-console`** (Figma Desktop Bridge): drzewo, zmienne, style,
  adnotacje, zmiany w pliku.
- **Figma REST API** (`FIGMA_TOKEN` w `.env`): eksport grafik i referencji
  do porównań, bez uruchomionej aplikacji.

## Komendy

Wszystko idzie przez npm. W PATH może nie być `php`, `composer` ani `wp`.
Wszystko, co dotyczy WordPressa, działa w Dockerze przez wp-env.

```bash
npm run setup              # jednorazowo: klient, prefiks, slug, plik Figmy
npm run sprawdz            # preflight: token Figmy, Docker, WordPress
npm run env:start          # WordPress pod projekt.json.urlLokalny (admin / password)
npm run wp -- <args>       # WP-CLI w kontenerze
npm run tokens             # docs/figma/tokens.json -> theme/assets/css/tokens.css
npm run figma:assets -- <nodeId...> --format svg|png   # grafiki z Figmy (REST)
npm run figma:ref -- <slug> [--mobile]                 # referencje do porównań
npm run images             # optymalizacja obrazów (WebP + oryginał)
npm run fonts              # fonty self-hosted
npm run parity -- <slug> [--mobile]                    # porównanie z makietą
npm run agentation         # buduje pasek uwag (tylko lokalnie)
npm run php:install        # jednorazowo: PHPCS przez composer w kontenerze
npm run lint:php           # PHPCS motywu, musi dawać 0 błędów
npm run lint:mu            # PHPCS pluginów mu
npm run test:unit
npm run test:e2e -- <plik> --project=desktop
npm run deploy -- theme|mu|media|content|all
```

**Docker na macOS z Apple Silicon:** jeśli `wp-env start` pada na braku
`docker compose`, `/usr/local/bin/docker` jest binarką x86 pod Rosettą.
Poprzedź komendę `export PATH=/opt/homebrew/bin:$PATH`. Nie wpisuj tej ścieżki
do skryptów, to ustawienie konkretnej maszyny.

Przed pracą z przeglądarką albo WP-CLI sprawdź, czy WordPress wstał:
`curl -s -o /dev/null -w '%{http_code}' <urlLokalny z projekt.json>` powinno dać 200.

## Architektura

### Tokeny są generowane, nie pisane

```
Figma (zmienne, style) -> Claude przez MCP -> docs/figma/tokens.json
  -> npm run tokens -> theme/assets/css/tokens.css (GENEROWANY, nie edytuj)
```

Dwie warstwy kolorów: prymitywy i semantyka. Alias z Figmy zostaje aliasem
w CSS. W kodzie sekcji używasz **wyłącznie tokenów semantycznych**, zero hexów.
Brakuje tokenu? Dopisz go do `tokens.json` albo zgłoś, nie wstawiaj hexa.

### Sekcja to stały zestaw plików

| Plik | Rola |
|---|---|
| `theme/template-parts/sections/home-{slug}.php` | markup; dane przez `get_field()` z wartością domyślną z makiety |
| `theme/assets/css/sections/home-{slug}.css` | style, klasy `.{prefiks}-{slug}__` |
| `theme/assets/js/{nazwa}.js` | tylko gdy adnotacja wymaga interakcji |
| `theme/inc/fields/home-{slug}.php` | grupa pól SCF, dopiero w fazie 6 |
| `docs/figma/sections/home-{slug}.md` | kontrakt: wymiary, tokeny, zachowania, mobile |

Sekcja nie modyfikuje plików współdzielonych. Arkusz ładuje sama przez
`{prefiks}_enqueue_section_style( 'home-{slug}' )`, a skrypt przez
`{prefiks}_enqueue_section_script( $nazwa )`. Obie funkcje są idempotentne.
Dzięki temu sekcje mogą powstawać równolegle bez konfliktów.

### Siatka: warstwy z makiety, gutter jako wcięcie ramki

Warstwy odczytujesz z *tej* makiety w fazie 2. Typowo: viewport → wrapper
(ramka strony) → kontener treści, czasem z warstwą pośrednią, na przykład
nagłówek 1600 między wrapperem 1820 a kontenerem 1480. W kodzie odpowiadają im
`.{prefiks}-wrapper` i `.{prefiks}-container`:

```css
width: min(calc(100% - (var(--{prefiks}-gutter-fluid) * 2)), var(--{prefiks}-wrapper));
margin-inline: auto;
```

- **Nie zagnieżdżaj kontenera we wrapperze.** Gutter odjąłby się dwa razy.
- **Tło na pełną szerokość kładź na rodzicu**, nie na wrapperze.
- `.{prefiks}-full-bleed` wyprowadza element na pełną szerokość viewportu.
- Na `html` jest `overflow-x: clip`, nie `hidden`. `clip` nie psuje
  `position: sticky` u potomków.

### Wierność: dwa tory

Różnica pikseli wyłapie złe kolory i odstępy, ale tonie w szumie tekstu.
Geometria jest odporna na szum, ale nie zauważy złego koloru. Dlatego oba naraz.

- **Rozjazd pozycji lub rozmiaru > 4 px:** blocker.
- **Różnica pikseli > 2 % poza maskami tekstu i zdjęć:** do poprawy.

Obszary tekstu są wyłączone z porównania pikselowego. Dla sekcji, w której
większość powierzchni to zdjęcie, różnica pikseli mierzy kadrowanie, nie jakość.
Podaj ją jako informację i idź dalej.

Priorytet wad: poziomy scroll strony, ucięta albo niewidoczna treść, rozjazdy
wysokości, zepsute interakcje. Kosmetyka potem.

### Pola w kodzie, nie w bazie

Grupy pól rejestrujesz przez `acf_add_local_field_group()` w `theme/inc/fields/`.
Nigdy nie klikasz ich w panelu, bo nie dałoby się ich wersjonować.
Używamy **Secure Custom Fields**, nie ACF. API jest to samo, a Repeater, Flexible
Content i Options Pages są za darmo. W `.wp-env.json` adres ZIP-a to
`secure-custom-fields.zip` **bez** `.latest-stable`, bo wp-env wyprowadza slug
wtyczki z nazwy pliku.

## Brak makiety mobilnej to normalny przypadek

Nie zakładaj, że dostaniesz komplet. W kontrakcie sekcji pole „mobile” ma wartość
`z makiety {nodeId}` albo `do zaprojektowania`. W drugim przypadku projektujesz
mobile od razu w kodzie, według reguł z `.claude/skills/kit-sekcje/mobile.md`.
Każdą taką decyzję zapisujesz w `docs/decyzje/rejestr.md` jako „wymyślone”.
Właściciel ocenia je w fazie 5, nie wcześniej.

`npm run parity -- <slug> --mobile` przy `"mobile": null` pomija porównanie
i kończy się sukcesem. Wtedy weryfikujesz zrzutem na 393 px.

## Rejestr decyzji

`docs/decyzje/rejestr.md` ma trzy tabele:
- **odejścia od makiety** na życzenie właściciela, żeby nikt ich nie „naprawił”
  z powrotem,
- **wymyślone** elementy, których makieta nie pokazuje,
- **ustalenia**, czyli rozstrzygnięcia niejednoznaczności, z uzasadnieniem.

Każdy wpis to jedna linia i powód.

## Konwencje

- Prefiks i slug są w `projekt.json`: funkcje `{prefiks}_`, stałe `{PREFIKS}_`,
  klasy `{prefiks}-`, text domain = slug. Katalog motywu w repo to zawsze `theme/`.
- `functions.php` zawiera tylko stałe i dołączanie modułów z `inc/`.
- Bez `!important`. Jedyny wyjątek to blok `prefers-reduced-motion` w `base.css`.
- Mobile-first, media queries przez `min-width`.
- Każda animacja respektuje `prefers-reduced-motion`.
- Dekoracje (linie siatki, dywidery) mają `aria-hidden`.
- Każdy `<img>` ma jawne `width` i `height`.
- Escapowanie na wyjściu: `esc_html`, `esc_attr`, `esc_url`, `wp_kses_post`.
  Teksty przez `__()` z domeną = slug.
- Sekcja poprawnie znika przy pustych polach.
- Commity po polsku, w trybie rozkazującym, bez emoji. Praca na gałęzi
  `strona-glowna`, a dla kolejnych widoków `widok-{nazwa}`.

## Praca z subagentami

- Agent dostaje brief z `.claude/skills/kit-sekcje/brief-sekcji.md`, w nim
  **kontrakt sekcji z liczbami**. Agent bez liczb zgaduje, a zgadnięte liczby
  były błędne za każdym razem.
- Agent uruchamia **wyłącznie swój pomiar i swoje `parity`**. Nigdy
  `npm run test:e2e` bez argumentu.
- Zakazane są polecenia git zmieniające stan (`add`, `commit`, `checkout`,
  `stash`, `reset`, `clean`). `status`, `diff` i `log` wolno.
- Commituje koordynator, po własnej weryfikacji zrzutem.
- Partie po 3–4 agentów. Pliki każdego agenta są rozłączne.

## Figma: pułapki API wtyczki

- `node.mainComponent` rzuca wyjątkiem przy `documentAccess: dynamic-page`.
  Używaj `await node.getMainComponentAsync()`.
- Przed przeszukiwaniem innych stron: `await figma.loadAllPagesAsync()`.
- Obiekty stylów tekstu zwracają `fontName: undefined`, gdy styl ma zmienne.
  Czytaj font z węzła tekstowego, nie ze stylu.
- Adnotacje żyją **też na stronie komponentów**, nie tylko na ramkach widoku.
  Pominięcie jej kosztowało kiedyś 11 z 19 adnotacji.
- Eksport PNG z REST renderuje „farbę” poddrzewa, a nie ramkę węzła. Dziecko
  wystające poza ramkę powiększa obraz. `parity` przycina to samo, ale wiedz,
  skąd bierze się rozjazd.
- Sekcje bez własnego tła eksportują się jako przezroczyste PNG. `parity`
  spłaszcza je na tło strony.
