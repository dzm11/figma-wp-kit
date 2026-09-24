---
name: kit-uwagi
description: Faza 5 frameworka Figma → WordPress. Przyjmuje uwagi właściciela z paska Agentation (albo zrzuty i opisy), klasyfikuje je, realizuje partiami równolegle i zapisuje świadome odejścia od makiety w rejestrze. Użyj, gdy właściciel wkleja uwagi do strony albo prosi o poprawki wyglądu.
---

# Faza 5: uwagi

Cel: uwaga właściciela zamienia się w poprawkę w ciągu minut, bez dopytywania
„który element masz na myśli”. Służy do tego pasek **Agentation**: każda
uwaga niesie selektor, pozycję i kontekst elementu.

## Jak właściciel zgłasza uwagi

Pasek jest w prawym dolnym rogu strony na `http://localhost:8888`, tylko
lokalnie. Nie ma go? Zbuduj go: `npm run agentation`.

1. Kliknij ikonę paska, potem element na stronie.
2. Wpisz uwagę, np. „za duży odstęp od góry” albo „ma być jak w Figmie”.
3. Powtórz dla kolejnych elementów, także na wąskim oknie albo w trybie
   urządzenia w DevTools.
4. „Copy”: skopiuj wszystkie uwagi i wklej je Claude'owi w jednej wiadomości.

Zrzuty ekranu i zwykły opis też działają. Wtedy sam ustalasz selektor.

**Podgląd na telefonie:** tunel (`cloudflared tunnel --url http://localhost:8888`)
plus domena tunelu dopisana w `mu-plugins/{prefiks}-tunnel-host.php`. Pasek
działa i tam, bo to wciąż lokalny WordPress.

## Co robisz z paczką uwag

### 1. Rozbiór

Każdą uwagę zamień na wiersz:

| # | selektor / element | plik-właściciel | rodzaj | co zrobić |
|---|---|---|---|---|

Rodzaje:
- **wierność**: odstaje od makiety, więc poprawiasz do makiety,
- **odejście**: właściciel chce inaczej niż w makiecie, więc robisz,
  jak chce, i **wpisujesz do rejestru**, żeby przy następnym porównaniu
  nikt tego nie „naprawił” z powrotem,
- **wymyślone**: dotyczy mobile bez makiety albo rzeczy spoza makiety,
  więc poprawiasz i aktualizujesz wpis w rejestrze,
- **globalne**: dotyczy komponentu albo tokenu, więc najpierw sprawdzasz
  **wszystkie** miejsca użycia.

Uwaga niejednoznaczna? Dopytaj **tylko o nią**, jednym pytaniem z propozycją.
Resztę realizuj.

### 2. Globalne przed lokalnymi

Zmiana komponentu albo tokenu zmienia wiele sekcji naraz.
1. Wypisz miejsca użycia.
2. Zmień.
3. Zmierz **każde** miejsce.

Zmiana psuje inne miejsce (inna instancja w makiecie ma inną wartość)?
Wprowadź modyfikator zamiast zmiany globalnej i zapisz ustalenie.

### 3. Realizacja

Uwagi pogrupowane po pliku-właścicielu idą do subagentów równolegle
(superpowers:dispatching-parallel-agents). Zasada: **jeden plik, jeden
agent**. Brief jak w `kit-sekcje/brief-sekcji.md`, ale zamiast kontraktu
lista uwag z wierszami tabeli. Drobne uwagi (1–3 linie CSS) robisz sam,
bez dispatchu.

### 4. Weryfikacja i raport

Każdą uwagę sprawdzasz zrzutem po zmianie. Raport dla właściciela:

| # | uwaga | status | co zmieniono |
|---|---|---|---|

Status: zrobione, zrobione inaczej (z powodem) albo wymaga decyzji.

Commit na paczkę: `Popraw {obszar} według uwag`. Odejścia i wymyślone
trafiają do `docs/decyzje/rejestr.md` w tym samym commicie.

## Kiedy faza się kończy

Właściciel mówi, że wygląd jest zaakceptowany, albo przechodzi do innego
tematu. Zaznacz fazę w `docs/stan.md` i zaproponuj fazę 6 (CMS).
Kolejne rundy uwag po CMS to nadal ten skill.
