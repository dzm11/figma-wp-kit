# Projektowanie mobile bez makiety

Makiety mobilnej nie ma, więc projektujesz ją sam, od razu w kodzie. Cel:
wersja, którą projektant desktopu uznałby za swoją. Ten sam system, te same
tokeny, te same komponenty, tylko inny układ. Nie przeprojektowujesz,
tylko **przekładasz**. Przy decyzjach, których reguły nie rozstrzygają, użyj
skilla `frontend-design`.

## Szerokość i siatka

- Szerokość referencyjna to 393 px, minimalna obsługiwana to 360 px.
  Sprawdź obie.
- Gutter mobilny: token `--{prefiks}-gutter-fluid` (clamp). Są inne ramki
  mobilne w pliku (np. nagłówek)? Weź gutter z nich.
- Jedna kolumna treści. Wyjątki: kafelki statystyk i logotypy (2 kolumny),
  drobne ikony z podpisem (2–3 kolumny).

## Układ

| Desktop | Mobile |
|---|---|
| kolumny obok siebie | jedna pod drugą, w kolejności czytania (tekst przed obrazem, chyba że obraz niesie treść) |
| siatka 3–4 kart | karuzela z przewijaniem (`scroll-snap`, widoczny skraj następnej karty) albo lista pionowa przy ≤ 3 kartach |
| rząd logotypów | 2 kolumny albo marquee, jeśli desktop ma marquee |
| tabela | karty z parami etykieta–wartość |
| nawigacja pozioma | menu pełnoekranowe za przyciskiem, akordeon podmenu, blokada scrolla, focus trap, Esc zamyka |
| mapa stopki w kolumnach | akordeony |
| dekoracje (linie siatki, duże kształty tła) | ukryte albo uproszczone, jeśli zabierają miejsce treści |
| duży odstęp sekcji (np. 120) | ~50–60 % wartości, **z istniejącej skali odstępów** |

## Typografia

- Nagłówki skalują się przez `clamp()` między wartością mobilną a desktopową.
  Wartość mobilna to **następny niższy styl z tokenów**, nie dowolna liczba.
  Makieta ma tylko jeden rozmiar? Nagłówek display ~55–65 % desktopu,
  nagłówek sekcji ~70 %, tekst główny bez zmian (min. 16 px).
- Interlinia z tokenu stylu, nie liczona na nowo.
- Żaden tekst poniżej 14 px, poza etykietami prawnymi (12 px).

## Dotyk i dostępność

- Cel dotyku min. 44 × 44 px. Małe ikony dostają większy obszar kliknięcia
  przez padding, nie przez większą ikonę.
- Hover z desktopu nie może nieść informacji niedostępnej inaczej.
  Na dotyku ta sama treść jest widoczna od razu albo po tapnięciu.
- Przyciski obok siebie, które się nie mieszczą, układają się w pion
  na pełną szerokość.

## Obrazy

- Kadr: `object-fit: cover` z `object-position` na obiekt zdjęcia.
- Obraz tła z tekstem na wierzchu: sprawdź kontrast na 393 px. Tekst przesuwa
  się na inny fragment zdjęcia, więc kontrast bywa gorszy niż na desktopie.
- `sizes` w `<img>` zgodne z faktyczną szerokością na mobile.

## Zapis decyzji

Każda decyzja, której nie da się wprost wyprowadzić z desktopu, trafia do
raportu w formacie wiersza tabeli „Wymyślone” z `docs/decyzje/rejestr.md`:

| sekcja | element | decyzja | dlaczego |
|---|---|---|---|
| home-projects | siatka 3 kart | karuzela, 1,15 karty w widoku | 3 × 452 px nie mieszczą się, skraj sygnalizuje przewijanie |

Właściciel ocenia te decyzje w fazie uwag. Nie pytasz o nie z góry.
