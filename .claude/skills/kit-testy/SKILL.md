---
name: kit-testy
description: Faza 7 frameworka Figma → WordPress. Dopisuje testy tam, gdzie się opłacają. E2e dla interakcji z adnotacji, smoke na czterech szerokościach, pełne porównanie z makietą. Bez testów deklaracji CSS. Użyj po podpięciu CMS, przed wdrożeniem.
---

# Faza 7: testy

Cel: zabezpieczyć to, co **psuje się po cichu przy kolejnych zmianach**, a nie
udowodnić, że CSS ma zadeklarowane wartości. Test czytający `getComputedStyle`
daje fałszywą pewność. Deklaracja `opacity: .55` przechodzi, choć warstwa
jest zasłonięta.

## Co testujemy

1. **Smoke całego widoku.** Jeden plik `theme/tests/e2e/smoke.spec.mjs`
   na wszystkie cztery projekty Playwrighta:
   - odpowiedź 200, zero błędów w konsoli,
   - brak poziomego przesuwu strony: `window.scrollTo( 10000, 0 )`, potem
     `scrollX === 0`. Sam `scrollWidth <= innerWidth` nie wystarcza, bo
     `overflow-x: clip` ukrywa pasek, a `scrollTo`, kotwica i fokus dalej
     przesuwają stronę,
   - brak elementów wystających poza kontener (`scrollWidth` sekcji),
   - każdy `<img>` ma `width` i `height`,
   - każda sekcja z `nodes.json` istnieje i ma niezerową wysokość,
   - jeden `<h1>`,
   - skip-link działa.

   Przy wielu widokach smoke iteruje po wszystkich adresach (`path`
   z `nodes.json`), nie tylko po stronie głównej.
2. **Interakcje z adnotacji.** Jeden plik na zachowanie, np.
   `header-sticky.spec.mjs` albo `projects-carousel.spec.mjs`. Kryteria
   akceptacji z kontraktu zamienione 1:1 w asercje:
   - klawiatura: Tab, Esc, strzałki,
   - `prefers-reduced-motion`,
   - stan po scrollu,
   - focus trap w menu.
3. **Formularze.** Każdy formularz testujesz dwa razy: wysyłka z JS
   (komunikat sukcesu i błędu walidacji bez przeładowania) i bez JS
   (`javaScriptEnabled: false`: POST, przekierowanie, komunikat). Wysyłka
   z JS potrafi nie działać nigdy (np. `form.action` zwracający
   `<input name="action">`), a ręcznie nikt tego nie sprawdzi.
   Wysyłkę poczty w teście przechwytuj, nie wysyłaj.
4. **Geometria krytyczna.** Tylko wymiary, które już raz się rozjechały
   (zapisane w rejestrze albo w commitach „Napraw…”). Test `boundingBox`
   z tolerancją 4 px.
5. **Porównanie z makietą** na wszystkich sekcjach, desktop i mobile, gdzie
   jest makieta. Wynik do `docs/figma/parity.md`. Rozjazdy wynikające
   z odejść w rejestrze oznacz jako oczekiwane.

Test zależny od treści, której może nie być (przypadek bez zdjęć, pusta
kolekcja, brak linku do filmu), pomijasz warunkowo: `test.skip( !warunek,
'powód' )` po sprawdzeniu treści na stronie. Nie zakładaj treści na sztywno,
bo test wywróci się po pierwszej zmianie redaktora.

## Czego nie testujemy

- Wartości CSS przez `getComputedStyle` jako dowodu wyglądu.
- Każdego wariantu każdego komponentu.
- Rzeczy, które zmieni najbliższa runda uwag.

## Uruchamianie

Podczas pisania: jeden plik, jeden projekt, mało workerów:
`npm run test:e2e -- smoke.spec.mjs --project=desktop --workers=1`.
Testy piszą agenci równolegle (plik na agenta)? Każdy uruchamia tylko swój plik
z `--workers=1` albo `2`. Kilku agentów z domyślną liczbą workerów zabija bazę
w kontenerze.

Pełny zestaw raz, na koniec fazy, u koordynatora: `npm run test:e2e --
--workers=4`. Czerwony test albo wada? Użyj superpowers:systematic-debugging,
zanim cokolwiek zmienisz.

Zaznacz fazę w `docs/stan.md`. Commit `Dodaj testy {widoku}`.
