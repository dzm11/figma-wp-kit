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
  Interlinię zapisuj z sześcioma miejscami po przecinku.
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

Sekcje niezależne od siebie mierz **równolegle subagentami**
(superpowers:dispatching-parallel-agents), po 3–4 naraz. Każdy dostaje
szablon kontraktu i zwraca gotowy plik.

Liczba węzłów sekcji to miara zakresu. Sekcja powyżej ~60 węzłów albo
z interakcjami (nagłówek, mega-menu, karuzela) dostaje osobnego agenta
w fazie 4 i ewentualnie podział. Nagłówek bywa pracą na trzy–cztery zadania.

## 6. Grafiki przez REST API

```bash
npm run figma:assets -- <nodeId...> --format svg --out theme/assets/img/icons
npm run figma:assets -- <nodeId...> --format png --scale 2 --out theme/assets/img/raw
npm run images
```

- Ikony: SVG, jeden sprite.
- Zdjęcia: PNG ×2, potem `npm run images` robi WebP.
- Logotypy: SVG, jeśli są wektorowe.

Szukaj ikon po **wszystkich** ramkach typu `Icon*` i wektorach `Glyph`, nie tylko
po instancjach biblioteki ikon. Nie wymyślaj nazw ikon, bierz je z Figmy.

## 7. Pytania

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
