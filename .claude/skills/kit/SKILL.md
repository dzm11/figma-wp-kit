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
4. Dalej fazy **2 → 4 → 5 → 6 → 7 → 8**, jak dla strony głównej, na gotowym
   fundamencie. Rekonesans zakłada plik `theme/inc/views/{widok}.php`,
   budowa sekcji idzie według sekcji „Podstrony” w `kit-sekcje`, a CMS według
   reguły `{prefiks}_view` w `kit-cms`.

## Wiele widoków naraz: workflow

Kilka podstron do przeniesienia? Nie prowadź ich po kolei ręcznie. Zbuduj
workflow (narzędzie Workflow, skill `workflow-authoring`), jeśli sesja je ma,
a jeśli nie, partie agentów:

- **Potok per widok:** rekonesans widoku A → budowa sekcji A, a w tym czasie
  rekonesans B. Budowa widoku startuje, gdy jego kontrakty są gotowe, bez
  czekania na rekonesans wszystkich.
- Przegląd (bramka fazy 4) raz, na komplet widoków z rundy.
- CMS także workflowem: najpierw kolekcje (typy treści, seedy), potem widoki
  równolegle.
- Testy: agent na plik testu, `--workers=1–2`. Pełny zestaw raz, u ciebie.
- **Wznawianie:** limit sesji przerwał workflow? Uruchom go ponownie
  z identyfikatorem przerwanego przebiegu (`resumeFromRunId`), jeśli narzędzie
  to wspiera. Każdy agent budowy ma w briefie zdanie „jeśli twoje pliki już
  istnieją, dokończ je”, więc powtórzony krok nie zaczyna od zera. Przed
  wznowieniem zapisz w `docs/stan.md`, co zostało niezweryfikowane.
- Commituje koordynator, po weryfikacji każdej partii albo widoku.

## Tryb bez bramek

Właściciel może zdjąć bramki na czas pracy ciągłej („nie zatrzymuj się,
wybieraj rekomendowane”, np. na noc). Wtedy:

- w bramce wybierasz domyślne rozstrzygnięcie (z `pytania.md` albo
  rekomendowane) i idziesz dalej,
- każde takie rozstrzygnięcie zapisujesz w `docs/decyzje/rejestr.md`
  (ustalenia) z dopiskiem „bez bramki”,
- decyzje nieodwracalne dalej wymagają zgody, chyba że właściciel wprost je
  objął: nadpisanie bazy na serwerze, zmiany w pliku Figmy, restart
  współdzielonej maszyny Dockera,
- na końcu piszesz jedno podsumowanie: co zrobione, co rozstrzygnąłeś
  sam (lista z rejestru), co czeka na ocenę, co zostało niezweryfikowane.

Tryb obowiązuje tylko w sesji, w której go ogłoszono. Zapisz go w
`docs/stan.md`, żeby przetrwał utratę kontekstu.

## Zasady, które obowiązują w każdej fazie

- Po każdej fazie aktualizujesz `docs/stan.md` i commitujesz.
- Decyzje i odejścia od makiety trafiają do `docs/decyzje/rejestr.md`.
- Coś poszło źle albo zajęło za długo? Dopisz jedną linię do sekcji
  „Kandydaci na lekcje” w `docs/stan.md`. Faza 9 zrobi z tego poprawki frameworka.
