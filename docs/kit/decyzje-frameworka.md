# Decyzje projektowe frameworka

Dlaczego framework wygląda tak, a nie inaczej. Zanim coś tu zmienisz,
sprawdź powód. Większość decyzji to odpowiedź na konkretny koszt z `LEKCJE.md`.

| Decyzja | Alternatywa odrzucona | Powód |
|---|---|---|
| Szablon repozytorium z gotowym kodem (motyw, narzędzia, pluginy) | same instrukcje; wtyczka Claude Code | cały pierwszy dzień projektu źródłowego to fundament i poprawki narzędzi, a tego nie da się opisać tak, żeby powstawało szybciej niż skopiowane. Wtyczka to dwa miejsca do utrzymania, a narzędzia i tak muszą żyć w projekcie (npm, Playwright) |
| Placeholdery `fwp` / `fwp-motyw` podmieniane raz przez `npm run setup` | prefiks czytany dynamicznie z konfiguracji | PHP i CSS nie mają sensownego mechanizmu prefiksu w czasie działania. Jednorazowa podmiana daje zwykły, czytelny kod |
| Wartości projektu poza prefiksem (fileKey, URL, szerokości) w `projekt.json`, czytane przez narzędzia w czasie działania | wartości wpisane w kod narzędzi | narzędzia zostają identyczne między projektami, więc ich poprawki da się przenosić |
| Kontrakty sekcji z pomiaru zamiast planu implementacji | plan z pełnym kodem (superpowers:writing-plans) | plan pisany przed pomiarem mylił się w każdej sekcji (lekcja 1) |
| Faza porządków w Figmie przed rekonesansem | czytanie makiety w stanie zastanym | znaczące nazwy warstw i adnotacje zachowań skracają każdy odczyt przez MCP i każdy brief. Zmiany tylko na kopii albo po zapisaniu wersji |
| Wymagane oba kanały Figmy: Desktop Bridge (MCP) i REST API | tylko jeden | MCP daje zmienne, adnotacje i zmiany w pliku. REST daje eksport grafik i referencji bez uruchomionej aplikacji |
| Wygląd → uwagi → CMS → testy | TDD od początku | żadnej wady wyglądu nie znalazł test (lekcja 6). Pola projektowane przed akceptacją wyglądu trzeba projektować drugi raz |
| Mobile bez makiety projektowany od razu w kodzie, oceniany w fazie uwag | szkic w Figmie do akceptacji przed kodem | szybciej. Zapis w rejestrze jako „wymyślone” daje właścicielowi pełny obraz przy przeglądzie |
| Pasek uwag Agentation tylko lokalnie, tylko dla właściciela | zbieranie uwag klienta na podglądzie | zero infrastruktury i zero ryzyka na serwerze. Uwagi klienta przekazuje właściciel |
| Bramki tylko w pięciu miejscach (zmiany w Figmie, plan sekcji, przegląd, import bazy, zmiany frameworka) | zatwierdzanie każdej fazy | w pozostałych miejscach decyzje są już zapisane w `CLAUDE.md`. Pytanie o nie to strata czasu właściciela |
| Plan mode na fazy 0–2, auto mode od fazy 3 | jeden tryb przez cały projekt | fazy 0–2 zmieniają plik Figmy i ustalają zakres, więc właściciel ma zobaczyć plan. Od fazy 3 budujemy według zatwierdzonego planu |
| `/init` na końcu fazy 3 | na starcie | w pustym motywie udokumentowałby domysły zamiast faktów |
| Faza lekcji tworzy gałąź w repozytorium frameworka, nie scala | tylko notatka w `LEKCJE.md` | lekcja zapisana, ale niewprowadzona, niczemu nie zapobiega. Scalanie należy do właściciela |
