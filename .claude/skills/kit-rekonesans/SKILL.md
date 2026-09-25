---
name: kit-rekonesans
description: Faza 2 frameworka Figma → WordPress. Mierzy makietę widoku i zamienia ją w dane. Tokeny do tokens.json, mapa węzłów do nodes.json, kontrakt z liczbami dla każdej sekcji, grafiki przez REST API, fonty, lista pytań. Kończy się planem sekcji do zatwierdzenia. Użyj po porządkach w Figmie oraz na początku każdego nowego widoku.
---

# Faza 2: rekonesans

Cel: **żadna liczba w kodzie nie będzie zgadnięta.** Każdy wymiar, odstęp,
styl tekstu i kolor, którego użyje subagent, stoi w kontrakcie sekcji
i pochodzi z pomiaru. Kontrakty zastępują plan implementacji.

Zanim zaczniesz: `figma_get_status` musi pokazywać właściwy plik,
a `npm run sprawdz` przechodzić.

## 1. Zakres i model treści (superpowers:brainstorming, skrótowo)

Jedno krótkie przejście z właścicielem, **raz na widok**:
- Które elementy widoku są treścią edytowalną? Na przykład teksty sekcji,
  listy projektów, aktualności.
- Co jest globalne (telefon, e-mail, social, stopka), a co należy do widoku?
- Które powtarzalne kolekcje to osobne typy treści (projekty, usługi, wpisy)?
- Jakie wersje językowe?

Właściciel już to rozstrzygnął w wiadomości albo w `docs/decyzje/rejestr.md`?
Nie pytaj ponownie, tylko potwierdź jednym zdaniem.

## 2. Tokeny (tylko przy pierwszym widoku)

Schemat `docs/figma/tokens.json` jest opisany w `docs/figma/README.md`.
- Kolory: `figma_get_variables` z rozwiązanymi aliasami. Prymitywy i semantyka
  osobno. **Alias zostaje aliasem.**
- Typografia: style tekstu (`figma_get_text_styles`). Rodzinę i wagę czytaj
  z węzła tekstowego, który używa stylu, gdy styl zwraca `fontName: undefined`.
  Interlinię zapisuj z **pełną precyzją** odczytu (bez zaokrąglania do trzech
  czy sześciu miejsc). `npm run tokens` sam dobiera precyzję: wartość bliską
  całemu pikselowi zaokrągla w górę, bo ułamkowa interlinia (28,984 zamiast
  29 px) przesuwa każdą niższą sekcję o pół piksela.
- Promienie i cienie też są tokenami (`radius`, `shadow` w `tokens.json`),
  nie liczbami w sekcjach.
- Layout: szerokość wrappera, kontenera, gutter i ewentualne warstwy pośrednie
  **zmierzone na ramkach**, nie wzięte z nazw. Skala odstępów to **zbiór
  wartości faktycznie użytych** w auto-layoutach (gap i padding) widoku, a nie
  wymyślona progresja.
- `npm run tokens`, potem sprawdź wynik w `theme/assets/css/tokens.css`.

Przy kolejnych widokach dopisujesz tylko brakujące tokeny.

## 3. Fonty

Rodziny z typografii: Google Fonts pobierasz przez `npm run fonts` do
`theme/assets/fonts/`. Fonty komercyjne: poproś właściciela o pliki i nie
zastępuj ich po cichu innymi.

**Zaraz po `npm run fonts` sprawdź wersję fontu.** Google Fonts serwuje
bieżące wydanie, a Figma bywa na starszym. Różnica 1–3 % szerokości daje
rozjazdy 4–14 px w rzędach tekstu i wygląda jak błąd CSS. Test: wyrenderuj
w przeglądarce 3–4 teksty z makiety (nagłówek, akapit, przycisk) tym samym
stylem i porównaj szerokość z ramką węzła tekstowego (auto-width) w Figmie.
Różnica > 1 %? Przypnij wersję zgodną z Figmą (np. z pakietu npm albo
repozytorium fontu z tagiem wersji), zapisz ustalenie w rejestrze i powtórz
test.

## 4. Mapa węzłów

Najpierw szerokości ramek widoku: wpisz do `projekt.json` →
`figma.ramki.desktop` szerokość ramki desktopowej (np. 1920, 1440, 1280),
a do `figma.ramki.mobile` szerokość mobilnej, jeśli jest (np. 393, 375).
Porównanie z makietą renderuje stronę dokładnie w tych szerokościach.
`szerokosciTestowe` to osobna rzecz: cztery szerokości, na których działają
testy e2e i kontrola poziomego scrolla. Nie zmieniaj ich pod ramkę.

`docs/figma/nodes.json` (schemat w `docs/figma/README.md`): dla każdej sekcji
`desktop` nodeId, `mobile` nodeId albo `null` i `area.selector`, czyli warstwę
siatki, której odpowiada ramka węzła. Ramka mierzy kontener treści (np. 1480)?
Selektor wskazuje `.{prefiks}-container`, nie całą sekcję, inaczej porównanie
zawsze pokaże rozjazd.

Następnie `npm run figma:ref -- <slug>` i `--mobile` dla każdej sekcji
z makietą mobilną.

**Kolejność warstw.** Sprawdź `itemReverseZIndex` na ramce strony
(i na ramkach grupujących sekcje). Przy `true` wcześniejsza sekcja leży **nad**
późniejszą, więc dekoracje wystające w dół (bloby, fale) przykrywają następną
sekcję. W HTML jest odwrotnie. Zapisz to w kontraktach i jako ustalenie
w rejestrze. Fundament da sekcjom `isolation: isolate` i malejący `z-index`
w dół strony.

## 5. Kontrakty sekcji

Dla każdej sekcji `docs/figma/sections/home-{slug}.md` według
`szablon-kontraktu.md` z tego skilla.

Pomiar przez MCP: węzeł sekcji z pełną głębokością (`figma_execute`
z przejściem po drzewie albo `figma_get_component_for_development_deep`).
Wypisz **tylko to, czego subagent potrzebuje do zbudowania sekcji**:
- wymiary ramek,
- kierunek, gap i padding auto-layoutu,
- wyrównania,
- style tekstu,
- tokeny kolorów,
- promienie, obrysy, cienie, efekty,
- listę grafik z nodeId,
- zachowania z adnotacji, łącznie z adnotacjami komponentów.

Zachowania nie zawsze są w adnotacjach. Poszukaj w pliku **ramek
dokumentacji** (nazwy typu „Interakcje”, „Animacje”, „Stany”, „Specyfikacja”,
tekst obok ramek widoku) i stron z opisem stanów hover/focus. Opis tekstowy
jest tak samo wiążący jak adnotacja. Wpisz go do kontraktu ze źródłem
(nodeId ramki). Dokumentacja sprzeczna z ramką widoku? Obowiązuje ramka,
bo zwykle jest nowsza, a sprzeczność trafia do pytań.

Sekcje niezależne od siebie mierz **równolegle subagentami**
(superpowers:dispatching-parallel-agents), po 3–4 naraz. Każdy dostaje
szablon kontraktu i zwraca gotowy plik.

Liczba węzłów sekcji to miara zakresu. Sekcja powyżej ~60 węzłów albo
z interakcjami (nagłówek, mega-menu, karuzela) dostaje osobnego agenta
w fazie 4 i ewentualnie podział. Nagłówek bywa pracą na trzy–cztery zadania.

## 6. Grafiki przez REST API

```bash
npm run figma:assets -- <nodeId...> --format svg --out design-assets/raw/icons
npm run icons
npm run figma:fills -- <imageRef[=nazwa]…> --out design-assets/raw/photos
npm run images -- --src design-assets/raw/photos --out theme/assets/img/photos
```

- **Ikony:** SVG do `design-assets/raw/icons/` (nazwa pliku w kebab-case
  z nazwy komponentu), potem `npm run icons` składa sprite
  `theme/assets/img/icons.svg` z kolorami na `currentColor`. W PHP ikona to
  `{prefiks}_icon( 'nazwa' )`. Ikony liniowe sprawdź zrzutem: zalana kolorem
  ikona znaczy, że zgubił się `fill="none"`.
- **Zdjęcia:** oryginały wypełnień IMAGE przez `npm run figma:fills` po hashu
  `imageRef` z kontraktu, nie eksport węzła. Eksport węzła wypala nakładki,
  gradienty i zaokrąglenia karty w obraz, a te sekcja robi w CSS.
  Eksport PNG ×2 (`figma:assets --format png --scale 2`) tylko wtedy, gdy obraz
  naprawdę jest kompozycją (kolaż, zdjęcie z wektorową ramką).
  Potem `npm run images` robi WebP.
- Logotypy: SVG, jeśli są wektorowe.

Szukaj ikon po **wszystkich** ramkach typu `Icon*` i wektorach `Glyph`, nie tylko
po instancjach biblioteki ikon. Nie wymyślaj nazw ikon, bierz je z Figmy.

## 7. Kolejny widok (podstrona)

Przy widoku innym niż strona główna, dodatkowo:

- **Plik widoku zakładasz tutaj:** `theme/inc/views/{widok}.php` zwraca listę
  slugów sekcji w kolejności z makiety. Jeden plik na widok, więc widoki mogą
  powstawać równolegle bez wspólnego pliku. Slug bez partiala jest pomijany,
  więc lista może wyprzedzać kod. Widok = slug strony WordPressa (albo szablon
  „Układ: …”, zob. `kit-cms`), strona błędu = `404`.
- **Slugi sekcji** z prefiksem widoku (`{widok}-hero`, `{widok}-faq`), żeby
  pliki różnych widoków się nie zderzały. Sekcja powtarzana w kilku widokach
  z tym samym układem to `shared-{nazwa}`: jeden partial, treść per widok
  (zob. `kit-sekcje`).
- **`nodes.json`:** każdy wpis sekcji podstrony ma pole `path` (adres strony,
  np. `/kontakt/`), z którego `parity` bierze URL. Sekcja wspólna występuje
  w kilku widokach, więc jej klucze mają postać `slug@widok`
  (`shared-cta@kontakt`), każdy z własnym nodeId i `path`.
- Kontrakty: `docs/figma/sections/{slug}.md` z pełnym slugiem sekcji.
- Tokeny, fonty i komponenty już są. Dopisujesz tylko brakujące.

Wiele widoków naraz? Rekonesans i budowę prowadź potokiem per widok
(rekonesans widoku A → budowa A, w tym czasie rekonesans B), zob. `kit`.

## 8. Pytania

`docs/figma/pytania.md` łączy niespójności z `porzadki.md`, adnotacje
„[do potwierdzenia]” i wszystko, czego pomiar nie rozstrzyga. Każde pytanie ma
przy sobie **domyślne rozstrzygnięcie**, które zastosujesz, jeśli nikt nie
odpowie. Pytania nie blokują budowy.

## Bramka: plan sekcji

Pokaż właścicielowi tabelę:

| sekcja | węzły | mobile | interakcje | partia |
|---|---|---|---|---|

Pod nią podział na partie po 3–4 równoległych agentów (nagłówek i stopka
osobno, bo mają JavaScript) i najważniejsze pytania z domyślnymi odpowiedziami.
Zapytaj: „Zaczynam budowę według tego planu?”.

Po zgodzie: zaznacz fazę w `docs/stan.md`, commit
`Zmierz makietę {widok} i spisz kontrakty sekcji`.
