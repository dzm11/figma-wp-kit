---
name: kit-figma-porzadki
description: Faza 1 frameworka Figma → WordPress. Agent przygotowuje plik Figmy do odczytu przez MCP. Nadaje znaczące nazwy warstwom typu „Frame 123”, nazywa sekcje slugami, dopisuje adnotacje zachowań, wydziela oczywiste komponenty, podpina gołe kolory pod zmienne i audytuje niespójności. Użyj po fazie 0, przed rekonesansem.
---

# Faza 1: porządki w Figmie

Cel: plik, który czyta się jak specyfikacja. Warstwa „Frame 2087” nic nie mówi
ani tobie, ani subagentowi z briefem. `home-hero / Heading` mówi wszystko.
Adnotacja „karuzela, autoplay 5 s” zamienia się wprost w kryterium akceptacji.

Budżet: **do godziny.** Zakres to ramki strony głównej (desktop i mobile, jeśli
jest) oraz komponenty, których używają. Reszta pliku poczeka na swój widok.

## 0. Bramka: zgoda na zmiany w pliku

Zmieniasz plik, który zwykle należy do projektanta albo klienta. **Zanim
zmienisz cokolwiek, zapytaj** (AskUserQuestion):

- **Kopia (zalecane).** Właściciel robi File → Duplicate, otwiera kopię,
  uruchamia w niej Desktop Bridge i podaje link. Zaktualizuj
  `projekt.json.figma.fileKey` i ponownie sprawdź `figma_get_status`.
  Oryginał zostaje nietknięty.
- **Oryginał z punktem przywracania.** Przed zmianami zapisz wersję:
  `await figma.saveVersionHistoryAsync('Przed porządkami pod WordPress')`
  przez `figma_execute`.
- **Tylko audyt, bez zmian.** Robisz kroki 1 i 6, a propozycje z kroków 2–5
  trafiają do raportu jako lista dla projektanta.

Bez odpowiedzi nie modyfikujesz pliku.

## 1. Rozpoznanie (tylko odczyt)

Przez MCP `figma-console`:
- `await figma.loadAllPagesAsync()`, potem lista stron i ramek najwyższego
  poziomu z wymiarami. Ustal ramkę desktop i mobile strony głównej.
  Mobile może nie istnieć, to normalne.
- Adnotacje: `figma_get_annotations` na ramkach strony głównej **i na stronie
  z komponentami**. Adnotacje komponentów łatwo przeoczyć.
- `figma_lint_design` i `figma_audit_design_system` na ramkach strony głównej.
- Zrzut ramek (`figma_take_screenshot`) jako punkt odniesienia „przed”.

## 2. Nazwy sekcji i warstw

- Bezpośrednie dzieci ramki strony głównej, które są sekcjami, nazwij
  `home-{slug}`, np. `home-hero`, `home-clients`, `home-news`. Slug:
  angielski, krótki, kebab-case. Ten sam slug dostanie w kodzie plik
  sekcji i wpis w `nodes.json`. Nagłówek i stopka to `site-header`
  i `site-footer`.
- Warstwy o generycznych nazwach (`Frame \d+`, `Group \d+`, `Rectangle \d+`,
  `Vector`, `Ellipse \d+`) wewnątrz tych sekcji nazwij według roli: `Heading`,
  `Lead`, `Actions`, `Media`, `Card list`, `Divider`, `Background`, `Icon / arrow`.
  Rób to wsadowo przez `figma_execute`, sekcja po sekcji, i loguj każdą zmianę
  (stara nazwa → nowa).
- **Nie zmieniaj** nazw instancji komponentów ani warstw tekstowych
  z sensowną nazwą.

## 3. Adnotacje zachowań

Tam, gdzie makieta wyraźnie sugeruje zachowanie, a adnotacji brak, dopisz ją
przez `figma_set_annotations` z etykietą zaczynającą się od
**„[do potwierdzenia]”**. Chodzi o:
- karuzelę (strzałki, kropki, przycięte karty na krawędzi),
- przyklejony nagłówek,
- hover (warianty komponentu),
- akordeon,
- licznik,
- marquee (logotypy w rzędzie wychodzącym poza ekran),
- menu mobilne.

Opisuj **zachowanie i źródło danych**, nie wygląd, np. „karuzela projektów:
ostatnie 6 wpisów typu projekt, przewijanie po jednym, bez autoplay”.

## 4. Komponenty, tylko bezpieczne

Wydzielasz komponent tylko wtedy, gdy ten sam układ powtarza się **co najmniej
3 razy** z identyczną strukturą, a różni się wyłącznie treścią: karty,
kafelki, pozycje listy, logotypy.

1. `figma.createComponentFromNode()` na pierwszym wystąpieniu.
2. Pozostałe wystąpienia zamień na instancje z przeniesioną treścią.
3. Zrzut przed i po. **Jakakolwiek zmiana wyglądu oznacza wycofanie**
   i wpis do raportu jako sugestię.

Wątpliwy przypadek? Nie komponentyzuj, tylko opisz w raporcie.

## 5. Kolory i style

Gołe wypełnienia (hex bez zmiennej), których wartość **dokładnie** odpowiada
istniejącej zmiennej koloru, podepnij pod tę zmienną. Wartość bez odpowiednika
zostaw i wpisz do raportu: to kandydat na nowy token albo błąd projektanta.
To samo z tekstami bez stylu tekstu.

## 6. Raport

Zapisz `docs/figma/porzadki.md`:
- tryb pracy (kopia, oryginał z wersją, sam audyt) i link do pliku,
- mapa sekcji: slug → nodeId desktop → nodeId mobile albo „brak makiety”,
- liczba zmienionych nazw na sekcję (pełna lista w `<details>`),
- dopisane adnotacje „[do potwierdzenia]”,
- wydzielone komponenty i odrzucone sugestie,
- **niespójności dla projektanta**. Na przykład ten sam komponent z różnym
  paddingiem w różnych instancjach, kolory spoza zmiennych, teksty bez stylu,
  elementy szersze od ramki mobilnej. Każda pozycja: gdzie, co, dlaczego
  przeszkadza.

Zrzut „po” musi być wizualnie identyczny z „przed”. Porządki nie zmieniają
wyglądu, tylko strukturę i opis.

## Zamknięcie fazy

Pokaż właścicielowi w pięciu–ośmiu liniach:
- ile sekcji,
- czy jest mobile,
- ile nazw zmienionych,
- co jest do potwierdzenia,
- listę niespójności.

Zapytaj tylko o adnotacje „[do potwierdzenia]”, które zmieniają zakres:
karuzela czy statyczna siatka, animacja czy nie. Resztę rozstrzygasz sam
i zapisujesz w rejestrze.

Zaznacz fazę w `docs/stan.md`, commit `Uporządkuj makietę pod odczyt`.
