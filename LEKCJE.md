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
