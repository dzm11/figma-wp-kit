---
name: kit-fundament
description: Faza 3 frameworka Figma → WordPress. Siatka i typografia bazowa z tokenów, komponenty współdzielone (przycisk, karta, ikony), jedna sekcja wzorcowa zbudowana przez koordynatora, kalibracja narzędzia porównawczego i /init na koniec. Użyj po zatwierdzeniu planu sekcji, przed równoległą budową.
---

# Faza 3: fundament

Cel: wszystko, na czym stoją sekcje, działa i jest **zmierzone**, zanim
ruszy równoległa budowa. Błąd w siatce albo w przycisku powielony przez
siedmiu agentów to siedem rund poprawek.

## 1. Siatka

Tokeny layoutu są w `tokens.css`. `layout.css` ma `.{prefiks}-wrapper`,
`.{prefiks}-container` i `.{prefiks}-full-bleed`.

1. Sprawdź, czy warstwy z rekonesansu mają odpowiedniki. Warstwa pośrednia
   (np. nagłówek 1600) to trzecia klasa w `layout.css`, a nie wartość
   wpisana w sekcji.
2. Zmierz w przeglądarce (Playwright, `boundingBox`) szerokość i `x` obu
   warstw na czterech szerokościach z `projekt.json`.
3. Porównaj z makietą. Rozjazd > 4 px trzeba naprawić tu, nie w sekcjach.

## 2. Typografia bazowa

W `base.css` tylko style elementów globalnych: `body`, nagłówki `h1–h6`
(jeśli makieta ma spójną hierarchię), linki, `::selection`, focus. Wszystko
na tokenach. Style tekstu konkretnych sekcji zostają w sekcjach.

## 3. Komponenty współdzielone

Z kontraktów wybierz to, czego używają **co najmniej dwie sekcje**: przycisk,
kartę, ikonę ze sprite, etykietę, pole formularza. Każdy komponent to:

- `theme/template-parts/components/{nazwa}.php`, partial z argumentami przez
  `get_template_part( ..., $args )`,
- `theme/assets/css/components/{nazwa}.css`.

Komponenty niezależne od siebie budują równolegle subagenci (brief jak dla
sekcji, z tabelą wariantów z Figmy). **Warianty bierz z instancji faktycznie
użytych w widoku**, nie ze wszystkich w bibliotece. Nieużyty wariant to kod
bez weryfikacji.

Figma ma ten sam komponent z różnymi wartościami w różnych instancjach
(padding 24 tu, 32 tam)? Wybierz wartość zgodną z większością instancji,
zapisz ustalenie w rejestrze i dopisz pytanie dla projektanta. **Nie zmieniaj
komponentu globalnie pod jedną instancję**, bo zepsujesz pozostałe.

Efekty (poświata, cień, nakładka, `z-index: -1`) sprawdzasz **zrzutem**,
nie odczytem `getComputedStyle`. Deklaracja `opacity: .55` nic nie mówi
o tym, czy warstwę widać.

## 4. Lista sekcji i sekcja wzorcowa

Najpierw wpisz **wszystkie** slugi sekcji widoku, w kolejności z makiety,
do `{prefiks}_home_sections()` w `theme/inc/sections.php`. Slug bez partiala
jest pomijany, więc lista może wyprzedzać kod. Dzięki temu żaden agent
w fazie 4 nie musi dotykać tego wspólnego pliku.

Najprostszą sekcję z kontraktem (zwykle hero) budujesz **sam, jako
koordynator**, według `.claude/skills/kit-sekcje/brief-sekcji.md`. Ustalasz na
niej wzorzec, który subagenci potem powielą:
- strukturę partiala,
- wartości domyślne z makiety,
- ładowanie stylu,
- nazewnictwo klas BEM `.{prefiks}-{slug}__element`.

## 5. Kalibracja porównania

Narzędzie porównawcze musi udowodnić, że mierzy, zanim mu zaufasz:

1. `npm run parity -- home-{wzorcowa}`: zapisz wynik.
2. Celowo zepsuj sekcję (np. `margin-top: 20px` na tytule) i uruchom ponownie.
   Porównanie **musi** zgłosić rozjazd w tym miejscu.
3. Cofnij zmianę.

Porównanie nie wyłapało celowego błędu? Napraw narzędzie teraz, zanim
zaczniesz na nim polegać przy wszystkich sekcjach. Użyj
superpowers:systematic-debugging i dopisz lekcję.

## 6. `/init`

Teraz, nie wcześniej, projekt ma strukturę, działające komendy i konwencje.
Uruchom skill `init` (albo poproś właściciela o `/init`), żeby dopisał do
`CLAUDE.md` fakty tego projektu. Po jego pracy sprawdź, że:
- sekcje frameworka (zasady, fazy, konwencje, pułapki) zostały **nietknięte**,
- nowe fakty trafiły do osobnej sekcji `## Ten projekt` na końcu pliku:
  klient, warstwy siatki, fonty, komponenty, nietypowe decyzje,
- każda wymieniona komenda faktycznie działa.

## Zamknięcie fazy

Zrzut strony w szerokości ramek z `projekt.json` (`figma.ramki`, zwykle desktop i 393) (nagłówek i stopka jeszcze mogą być puste).
Zaznacz fazę w `docs/stan.md`. Commit `Zbuduj fundament: siatka, komponenty,
sekcja wzorcowa`. Bez pytania przejdź do `/kit-sekcje`.
