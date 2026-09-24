# Kontrakt sekcji: home-{slug}

> Źródło prawdy dla budowy sekcji. Każda liczba tutaj pochodzi z pomiaru
> w Figmie. Czego tu nie ma, tego subagent nie zgaduje: pyta albo zgłasza.

## Węzły

| | nodeId | ramka | uwagi |
|---|---|---|---|
| desktop | `470:29428` | 1820 × 720 | |
| mobile | `470:32972` albo **do zaprojektowania** | 393 × 573 | |

Warstwa siatki (`area.selector` w nodes.json): `.{prefiks}-container` albo
`.{prefiks}-wrapper`. Tło sekcji: na rodzicu, pełna szerokość, tak albo nie.

## Struktura i układ, desktop

Drzewo w skrócie, od góry, z auto-layoutem każdego kontenera:

```
home-{slug}                 pionowo, gap 48, padding 120/0/120/0, tło bg-inverse
├─ Heading                  pionowo, gap 16, wyrównanie: lewo
│  ├─ Eyebrow               Text sm/Medium, text-brand, uppercase, ls 0.08em
│  └─ Title                 Heading xl/Semibold, text-primary, max-width 880
├─ Card list                poziomo, gap 24, 3 × Card Type=Project (452 × 560)
└─ Actions                  Button size=lg type=primary „Zobacz wszystkie”
```

## Wymiary kluczowe

| element | szerokość | wysokość | x od lewej krawędzi obszaru | uwagi |
|---|---|---|---|---|

## Typografia

| element | styl Figmy | token | rozmiar / interlinia / waga / tracking |
|---|---|---|---|

## Kolory i efekty

| element | właściwość | token semantyczny |
|---|---|---|

Promienie, obrysy, cienie, rozmycia, gradienty z wartościami.

## Grafiki

| element | nodeId | format | plik docelowy |
|---|---|---|---|

## Zachowania (z adnotacji)

- **[adnotacja / [do potwierdzenia]]** opis zachowania i źródła danych.
  Kryterium akceptacji: co musi być prawdą, żeby uznać to za zrobione.

## Mobile

- **Z makiety:** te same tabele dla węzła mobilnego (tylko różnice).
- **Do zaprojektowania:** co się dzieje z każdym blokiem według
  `.claude/skills/kit-sekcje/mobile.md`: kolumny w pion, skala typografii,
  ukryte dekoracje, karuzela zamiast siatki.

## Treść

Teksty z makiety dosłownie. Trafią do kodu jako wartości domyślne pól CMS.

## Komponenty współdzielone

Których zbudowanych już komponentów sekcja używa (przycisk, karta, ikona)
i w jakich wariantach.
