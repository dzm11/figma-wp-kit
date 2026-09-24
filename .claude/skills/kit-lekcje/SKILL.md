---
name: kit-lekcje
description: Faza 9 frameworka Figma → WordPress. Zamienia doświadczenia z projektu w poprawki frameworka. Zbiera kandydatów na lekcje, oddziela uniwersalne od specyficznych, dopisuje je do LEKCJE.md i przygotowuje zmiany w repozytorium zestawu na osobnej gałęzi do zatwierdzenia. Użyj po wdrożeniu widoku albo gdy właściciel pyta, czego się nauczyliśmy.
---

# Faza 9: lekcje do frameworka

Cel: następny projekt zaczyna mądrzejszy. Każda godzina stracona na rzecz,
której framework mógł zapobiec, ma skończyć się poprawką frameworka, a nie
wspomnieniem.

## 1. Zbierz materiał

- Sekcja „Kandydaci na lekcje” w `docs/stan.md`.
- `git log`: commity „Napraw…”, „Popraw…”, cofnięcia, kolejne rundy poprawek
  tego samego pliku.
- `docs/decyzje/rejestr.md`: ustalenia, które powtórzą się u innych klientów.
- Rozjazdy wykryte dopiero przez właściciela, a nie przez pomiar.
- Miejsca, w których skill fazy kazał zrobić coś zbędnego albo czegoś
  nie powiedział.

## 2. Oddziel uniwersalne od specyficznego

Lekcja trafia do frameworka tylko wtedy, gdy **powtórzy się u innego
klienta**. Test: czy da się ją zapisać bez nazwy tego klienta i bez jego
wartości? „Figma eksportuje przezroczyste PNG dla sekcji bez tła” jest
uniwersalna. „Przycisk w sekcji O nas ma padding 32” nie jest.

## 3. Zapisz

**Repozytorium frameworka jest publiczne.** W `LEKCJE.md` zestawu i w
zmianach w nim nie ma nazwy klienta, jego domen, kluczy plików Figmy, adresów
serwerów, danych z makiety (teksty, nazwy produktów) ani niczego z `.env`.
Klienta oznaczasz kolejną literą: „Projekt B”, „Projekt C”. Przed commitem
w zestawie zrób `git diff` i przeczytaj go pod tym kątem.

- W projekcie: `LEKCJE.md`. Dopisz blok z datą, klientem i lekcjami
  w formacie istniejących wpisów: co się stało, ile kosztowało, co zmienić
  w frameworku.
- W zestawie, jeśli `projekt.json.kit.sciezka` wskazuje istniejące
  repozytorium frameworka:
  1. `git -C {sciezka} switch -c lekcje-projekt-{litera}-{data}`.
  2. Wprowadź zmiany tam, gdzie lekcja zapobiega problemowi: skill fazy,
     brief, reguły mobile, narzędzie w `tools/` (z testem), `CLAUDE.md`.
     Lekcja zapisana tylko w `LEKCJE.md` niczemu nie zapobiega.
  3. Dopisz ten sam blok do `LEKCJE.md` zestawu.
  4. Podnieś `version` w `package.json` zestawu: minor przy nowych
     możliwościach, patch przy poprawkach.
  5. Commit. **Nie scalaj do `main`.**

## Bramka

Pokaż właścicielowi listę lekcji (jedna linia na lekcję: problem → zmiana
we frameworku) i ścieżkę gałęzi w zestawie. Scala właściciel albo ty,
po jego wyraźnej zgodzie.

Zaznacz fazę w `docs/stan.md`.
