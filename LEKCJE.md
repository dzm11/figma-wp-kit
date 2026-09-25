# Lekcje

Każdy projekt dopisuje tu blok w fazie 9 (`/kit-lekcje`). Lekcja ma sens tylko
wtedy, gdy zmieniła coś w frameworku. Kolumna „co zmieniono” wskazuje, gdzie.

---

## 2026-09, Projekt A: strona główna (projekt źródłowy frameworka)

Strona główna: 7 sekcji, nagłówek z mega-menu, stopka, pasek ogłoszeń.
Około 19 godzin pracy i 84 commity od specyfikacji do podglądu na serwerze.
Framework powstał z tego, co w tym projekcie kosztowało czas.

| # | Co się stało | Koszt | Co zmieniono we frameworku |
|---|---|---|---|
| 1 | Plan wdrożenia (8352 linie, pełny kod 26 zadań) napisano **przed** pomiarem makiety. Wymiary w planie były zgadnięte i mylił się w każdej zweryfikowanej sekcji: promień 10 zamiast 24, gap 10 zamiast 48 | po 2–3 rundy poprawek na komponent | Brak planu z kodem. Planem są kontrakty sekcji z pomiaru (`kit-rekonesans`, `szablon-kontraktu.md`). `writing-plans` nie jest używany do sekcji |
| 2 | Adnotacje odpytano tylko na ramce strony, pominięto stronę komponentów: 8 zamiast 19. Nagłówek miał 56 węzłów, a plan zakładał „logo + nawigacja” | nagłówek rozbity na 4 zadania, stopka na 3 | Rekonesans czyta adnotacje także z komponentów. Liczba węzłów jako miara zakresu. Porządki w Figmie (`kit-figma-porzadki`) |
| 3 | Narzędzie porównawcze deklarowało pomiar, którego nie robiło. `test:unit` nie uruchamiał ani jednego testu | wady wyszły dopiero przy sekcjach | Kalibracja porównania celowym błędem w fazie 3 (`kit-fundament` §5) |
| 4 | Eksport PNG z Figmy ma rozmiar „farby” poddrzewa, nie ramki węzła. Sekcje bez tła są przezroczyste. Selektor łapał `<section>` 1920 zamiast kontenera 1480. Tekst generował szum pikseli | 4 osobne zadania naprawcze narzędzia | Wszystkie cztery poprawki są w `tools/parity.mjs`. `area.selector` w `nodes.json` |
| 5 | Testy czytające `getComputedStyle` przechodziły przy niewidocznej poświacie (`z-index: -1` za tłem rodzica) i martwej strefie kliknięcia | fałszywa pewność, wada wykryta w recenzji | Efekty weryfikowane zrzutem. `kit-testy` zakazuje testów deklaracji CSS. Pułapka w briefie sekcji |
| 6 | Żadnej wady wyglądu nie znalazł test. Nagłówek 250 zamiast 184 px, tekst 22 px za wysoko: znalazł je pomiar geometrii i zrzut | TDD na wygląd zjadało czas bez efektu | Kolejność: wygląd → uwagi → CMS → testy. Testy e2e dopiero w fazie 7 |
| 7 | Każdy agent uruchamiał pełne 349 testów we wspólnym WordPressie i wywracał testy innym | 260–290 tys. tokenów na zadanie | Agent uruchamia tylko swój pomiar i swoje `parity`. Pełny zestaw raz, u koordynatora |
| 8 | Domykanie sekcji do perfekcji po kolei zamiast szkicu całości | wolny postęp widoczny dla właściciela | Faza 4: cała strona „stoi i wygląda”, potem wspólny przegląd |
| 9 | Klient zobaczył stronę późno: 5 świadomych odejść od makiety i 2 rundy przebudowy nawigacji po pierwszym przeglądzie | przebudowy gotowych sekcji | Bramka przeglądu na końcu fazy 4. Pasek Agentation od fazy 0. Rejestr odejść |
| 10 | Komponent `Button` w Figmie miał różny padding w różnych instancjach (24 i 32). Globalna „poprawka” zepsuła nagłówek i została cofnięta | runda poprawek i cofnięcie | Audyt niespójności w fazie 1. Reguła „nie zmieniaj komponentu globalnie pod jedną instancję” (`kit-fundament`, `kit-uwagi`) |
| 11 | Za ciasny zakres plików w briefie nagłówka wymusił spłaszczoną strukturę | 3 rundy poprawek | Brief mówi „brakuje czegoś we wspólnym pliku, to zgłoś”. Nagłówek i stopka jako osobne, większe zadania |
| 12 | Zakaz wszystkich poleceń git dla agentów łamano, bo `git status` to naturalna kontrola po sobie | reguła, której nie dało się przestrzegać | Zakaz dotyczy tylko poleceń zmieniających stan |
| 13 | `overflow-x: clip` na `html` ukrył ucięty przycisk CTA w nagłówku przy 1024–1280 | wada niewidoczna bez pomiaru | Weryfikacja `scrollWidth` elementów, nie tylko strony. Pułapka w briefie |
| 14 | Blokada indeksowania podglądu powstała na końcu, w dwóch podejściach (`Allow` + noindex, potem `Disallow`). Wdrożenie SSH powstało doraźnie, z błędem uprawnień (rsync z macOS nie zna `--chmod`) | kilka commitów poprawek po wdrożeniu | Gotowy mu-plugin, `deploy.sh` z prostowaniem uprawnień po stronie serwera, `kit-wdrozenie` |
| 15 | Precyzja interlinii z trzech miejsc po przecinku dawała rozjazdy przy dużych rozmiarach | przegenerowanie tokenów | Sześć miejsc w `tokens-to-css` i w instrukcji ekstrakcji |
| 16 | Właściciel: „ma to po prostu działać”, gdy porównanie pokazało 38 % różnicy na sekcji ze zdjęciem (inne kadrowanie) | pogoń za kadrowaniem | Różnica pikseli na zdjęciach to informacja, nie bramka (`CLAUDE.md`, sekcja wierności) |

---

## 2026-09, Projekt B: strona główna i 18 podstron (firma usługowa, tryb pracy bez bramek)

Strona główna (16 sekcji + nagłówek, stopka) i 18 podstron (~107 sekcji), CMS (129 grup pól,
5 typów treści), 1072 testy e2e. Około dwóch dni, ~30 commitów koordynatora. Podstrony,
CMS i testy budowały workflowy z kilkudziesięcioma agentami; właściciel zdjął bramki
na noc („nie zatrzymuj się, wybieraj rekomendowane”).

| # | Co się stało | Koszt | Co zmieniono we frameworku |
|---|---|---|---|
| 1 | Font z Google Fonts był nowszą wersją niż w Figmie i o 1,2–2,5 % węższy; rzędy rozjeżdżały się o 4–14 px, a winny wydawał się CSS | kilka rund debugowania sekcji | `kit-rekonesans`: po `npm run fonts` porównaj szerokość kilku tekstów Figma ↔ przeglądarka i przypnij wersję fontu z Figmy |
| 2 | Interlinie w tokenach z 6 miejscami dawały ułamkowe wysokości (28,984 zamiast 29 px — LayoutUnit 1/64), każda niższa sekcja była przesunięta o pół piksela | rozjazdy 1 px i fałszywe alarmy porównań | `tokens-to-css`: interlinia bliska całym pikselom zaokrąglana w górę z 9 miejscami (test). `section-heading`: `line-height: round(…, 1px)` przy `clamp()` |
| 3 | Porównanie z makietą dawało fałszywe wyniki: zrzut w trakcie animacji wejścia, obrazy lazy niewczytane lub niezdekodowane, pasek uwag i FAB na zrzucie, `scroll-padding-top` przesuwał zrzut elementu, `sizes="auto"` pobierało obraz drugi raz | kilkanaście fałszywych alarmów, godziny sprawdzania | `parity`: reducedMotion + `animations: disabled`, eager + load + `decode()`, ukrywanie obcych fixed/sticky, zerowanie `scroll-padding-top`, skupiska różnic w kafelkach 48 px, tolerancja 1 px, `path` wpisu (podstrony); `{prefiks}_image()` bez `sizes="auto"` |
| 4 | Oryginałów zdjęć nie dało się wyciągnąć eksportem węzła (wypalone gradienty, karty) | ręczne obejścia | Nowe narzędzie `npm run figma:fills` (oryginały wypełnień IMAGE po imageRef) z testem |
| 5 | Ikony eksportowane pojedynczo; sprite gubił `fill="none"` z `<svg>` i ikony liniowe zalewały się kolorem | złapane dopiero zrzutem | Nowe narzędzie `npm run icons` (sprite z `currentColor`, `fill` na `<symbol>`) z testem |
| 6 | Generator tokenów nie znał promieni ani cieni i tworzył cykl `var()` przy kolizji nazwy prymitywu i semantyki | liczby na sztywno w sekcjach | `tokens-to-css`: sekcje `radius`, `shadow`, walidacja kolizji (testy) |
| 7 | `overflow-x: clip` na `html` przechodzi na okno jako `hidden`: kółkiem się nie da, ale `scrollTo`, kotwica i fokus przesuwały stronę o 346 px wystających dekoracji | wada wykryta dopiero w fazie 7 | `layout.css`: `clip` także na `body`. Smoke sprawdza `scrollX` po `scrollTo(10000,0)`, nie `scrollWidth` |
| 8 | Bez JS nagłówek się nie zwija, a przesunięcie kotwic zakładało belkę po zwinięciu — kotwice chowały górę sekcji | zgłoszone przez 3 agentów testów | Klasa `{prefiks}-js` w `<head>`; offset bez JS = pełna belka. Pułapka w briefie sekcji |
| 9 | Formularz z JS nie wysyłał się nigdy: `form.action` zwraca `<input name="action">` wymagany przez `admin-post.php` | każdy użytkownik widział błąd; wykryte dopiero testem | Pułapka w briefie (`form.getAttribute('action')`); test formularza w `kit-testy` |
| 10 | Podstrony nie miały mechanizmu w zestawie; lista sekcji we wspólnym pliku blokowała równoległą pracę | projekt wymyślał strukturę w trakcie | Motyw: `page.php` + `inc/views/{widok}.php` (jeden plik na widok), `{prefiks}_current_view()`, układ strony jako szablon „Układ: …” (adres strony można zmienić), sekcje `shared-*` z treścią per widok. `kit` opisuje kolejne widoki |
| 11 | CMS: niezapisany repeater jest w panelu pusty, pierwsze „Aktualizuj” kasowało listy z makiety; pola strony głównej nie miały gdzie się zapisać bez statycznej strony głównej; pusty edytor bloków mylił redaktora | krytyczna wada wykryta przed wdrożeniem | Motyw `inc/cms.php`: `rows()` z fallbackiem i wczytywaniem listy z makiety do panelu, `image()`, `collection()`, reguła lokalizacji pól po widoku, bez edytora blokowego dla stron z układem. `kit-cms`: statyczna strona główna, seedy idempotentne w `tools/seed/` |
| 12 | Menu zapasowe (bez menu WP) miało puste adresy — na podglądzie nie dało się przejść do podstron | właściciel nie mógł nawigować | `kit-cms`/`kit-sekcje`: zapasowe linki rozwiązują adresy istniejących stron; brak strony = link nieaktywny |
| 13 | Równoległe agenty: ktoś uruchomił `wp-env status`, co nadpisało plik stanu i zablokowało WP-CLI wszystkim („Environment not initialized”) | kilka przerw w pracy | Brief: agenci tylko `wp-env run`, nigdy `start/status/stop`; obejście `docker exec` |
| 14 | 9 agentów testów z domyślną liczbą workerów zabiło bazę (OOM) w maszynie Dockera z 2 GB; poległa też baza innego projektu | restart środowiska | `kit-start`: Docker/Colima ≥ 6 GB przy pracy równoległej; agenci uruchamiają testy z `--workers=1–2`, pełny zestaw raz z `--workers=4` |
| 15 | PHPCS nie działał do fazy 7 (kontener bez DNS); po naprawie 24 błędy i 47 ostrzeżeń narosłych przez agentów | sprzątanie na końcu | `kit-start`: PHPCS musi działać przed fazą 3 (restart maszyny Dockera to rozwiązanie DNS); brief: `phpcs:ignore` nie działa na wieloliniowym `echo` — najpierw zmienna |
| 16 | Wdrożenie z drzewa roboczego wysłałoby niedokończone pliki równolegle pracujących agentów; import bazy resetował hasło admina, `blog_public` i język | ręczne poprawki po każdym imporcie | `kit-wdrozenie`: motyw z `git archive HEAD`; po imporcie treści: hasło, `blog_public 0`, język. Rekord DNS `*` dla subdomen podglądu |
| 17 | Limit sesji przerwał workflow w połowie (dwa razy) | wznowienie ręczne | `kit`: workflow z `resumeFromRunId`, agent budowy „dokończ, jeśli pliki istnieją” |
| 18 | Właściciel chciał zgłaszać uwagi na podglądzie, a pasek uwag działał tylko lokalnie | dopięcie w trakcie | Pasek uwag także w środowisku `staging` (nigdy produkcja); `kit-wdrozenie` opisuje wysłanie bundla |
