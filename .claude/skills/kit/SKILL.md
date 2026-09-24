---
name: kit
description: Punkt wejścia frameworka Figma → WordPress. Czyta docs/stan.md i projekt.json, mówi, która faza jest następna, i uruchamia jej skill. Użyj na początku każdej sesji, po utracie kontekstu albo gdy właściciel pisze „kontynuuj” lub podaje nazwę nowego widoku do przeniesienia.
---

# /kit: gdzie jesteśmy i co dalej

1. Przeczytaj `projekt.json`. Przy `"skonfigurowany": false` przejdź do `/kit-start`.
2. Przeczytaj `docs/stan.md` i ostatnie 10 commitów (`git log --oneline -10`).
3. Ustal fazę:
   - pierwsza faza bez `[x]` w `docs/stan.md` dla bieżącego widoku,
   - faza oznaczona `[~]` (w toku) ma pierwszeństwo: dokończ ją, zamiast
     zaczynać następną.
4. Powiedz właścicielowi w dwóch zdaniach: gdzie jesteśmy i co teraz robisz.
   Potem uruchom skill fazy.

## Nowy widok (podstrona)

Gdy właściciel prosi o kolejny widok, a strona główna ma fazy 0–8 zrobione:

1. Dopisz w `docs/stan.md` nowy blok widoku (skopiuj szablon bloku z dołu pliku).
   Fazy 0, 1, 3 i 9 oznacz jako `n/d`, bo fundament już jest.
2. Utwórz gałąź `widok-{nazwa}`.
3. Uruchom `/kit-rekonesans` dla ramek tego widoku.

   Komponenty już zbudowane (przyciski, karty, nagłówek, stopka) **użyj
   ponownie**. W kontrakcie nowej sekcji zaznacz, które z nich wykorzystuje.
   Porządki w Figmie (faza 1) powtórz tylko wtedy, gdy ramki nowego widoku
   mają generyczne nazwy warstw.

## Zasady, które obowiązują w każdej fazie

- Po każdej fazie aktualizujesz `docs/stan.md` i commitujesz.
- Decyzje i odejścia od makiety trafiają do `docs/decyzje/rejestr.md`.
- Coś poszło źle albo zajęło za długo? Dopisz jedną linię do sekcji
  „Kandydaci na lekcje” w `docs/stan.md`. Faza 9 zrobi z tego poprawki frameworka.
