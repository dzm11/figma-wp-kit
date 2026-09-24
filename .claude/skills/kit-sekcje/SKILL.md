---
name: kit-sekcje
description: Faza 4 frameworka Figma → WordPress. Buduje wszystkie sekcje widoku równolegle, partiami po 3–4 subagentów, z kontraktami z pomiaru, z treścią z makiety na sztywno i z projektowaniem mobile tam, gdzie makiety nie ma. Koordynator weryfikuje zrzutem i porównaniem, commituje partie. Kończy się przeglądem z właścicielem.
---

# Faza 4: szkic całości

Cel: **cały widok stoi i wygląda jak makieta**, na desktopie i mobile, zanim
ktokolwiek zacznie dopracowywać pojedynczą sekcję. Właściciel ocenia postęp
po tym, co widzi. Siedem sekcji na 90 % jest warte więcej niż dwie na 100 %.

## Kolejność

1. **Nagłówek i stopka.** Osobni agenci, bo mają JavaScript i najwięcej
   węzłów. Mogą iść równolegle z pierwszą partią sekcji: ich pliki są
   rozłączne.
2. **Sekcje treści partiami po 3–4** (superpowers:dispatching-parallel-agents).
   Kolejna partia startuje, gdy poprzednia jest zweryfikowana i zacommitowana.

## Dispatch

Każdy agent dostaje brief z `brief-sekcji.md` z wypełnionymi polami oraz
**pełną treść kontraktu sekcji wklejoną do promptu**, nie samą ścieżkę.
Kontrakt mówi „mobile: do zaprojektowania”? Do briefu dołącz `mobile.md`.

Agent z interakcją (karuzela, sticky, menu, akordeon) dostaje w briefie
kryteria akceptacji z adnotacji. Jego kod po oddaniu przechodzi
superpowers:requesting-code-review. Sekcje statyczne weryfikujesz sam.

## Weryfikacja koordynatora po każdym agencie

Raport agenta to deklaracja. Sprawdzasz sam:

1. Strona zwraca 200, log PHP bez błędów:
   `npm run wp -- eval 'echo ini_get("error_log");'`, a potem tail tego pliku
   w kontenerze.
2. Zrzut sekcji w szerokości ramek z `projekt.json` (`figma.ramki`, zwykle desktop i 393). **Obejrzyj go**, zestaw z referencją
   w `docs/figma/ref/`.
3. `npm run parity -- home-{slug}` oraz `--mobile`, jeśli jest makieta.
4. Brak poziomego scrolla na 393, 1024, 1440 i 1920
   (`document.documentElement.scrollWidth <= innerWidth`).
5. Rozjazd > 4 px, którego agent nie wyjaśnił, wraca do niego jako poprawka
   z konkretną liczbą.

Ten sam błąd w kilku sekcjach (np. selektor porównania łapie `<section>`
zamiast kontenera)? Naprawiasz go **raz, systemowo**, zamiast siedmiu
korekt u agentów.

Po weryfikacji partii: commit `Dodaj sekcje {lista}`.

## Zatrzymani agenci, limit sesji

Kończy się limit albo musisz przerwać? Zapisz w `docs/stan.md`, którzy agenci
co robili i czego **nie zweryfikowałeś**. Kod może być zacommitowany, ale
niezmierzony, i to trzeba wiedzieć po wznowieniu.

## Bramka: przegląd

Gdy wszystkie sekcje stoją:
- zrzut całej strony w szerokości ramek z `projekt.json` (`figma.ramki`, zwykle desktop i 393),
- lista rozbieżności, których świadomie nie naprawiłeś, z powodem,
- lista elementów „wymyślonych” (mobile bez makiety) z rejestru.

Napisz właścicielowi:

> Strona stoi. Obejrzyj ją na http://localhost:8888 na desktopie i telefonie.
> Uwagi zgłaszaj paskiem **Agentation** w prawym dolnym rogu: kliknij element,
> wpisz uwagę, na końcu skopiuj wszystkie i wklej mi tutaj. Mogę też
> udostępnić podgląd na telefon przez tunel.

Zaznacz fazę w `docs/stan.md`.
