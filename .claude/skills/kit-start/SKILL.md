---
name: kit-start
description: Faza 0 frameworka Figma → WordPress. Konfiguruje projekt (npm run setup), wymaga działającego Figma Desktop Bridge i klucza Figma REST API, stawia WordPressa, instaluje skille i daje właścicielowi wskazówki startowe (plan mode). Użyj, gdy projekt.json ma skonfigurowany=false albo właściciel zaczyna nowy projekt.
---

# Faza 0: start

Cel: po tej fazie działają trzy kanały, bez których reszta się nie opłaca.
Figma przez MCP (Desktop Bridge), Figma przez REST API (token) i WordPress
na localhost. **Nie przechodzisz do fazy 1, dopóki którykolwiek z nich
nie działa.** Każde obejście (zgadywanie wymiarów, zrzuty zamiast API)
zemści się w każdej sekcji.

## 1. Powitanie i tryb pracy

Na samym początku napisz właścicielowi krótko:

> Zaczynamy nowy projekt Figma → WordPress. Dwie rzeczy na start:
> 1. **Przełącz mnie na plan mode** (Shift+Tab, aż zobaczysz „plan mode”)
>    na czas faz 0–2. Przejrzysz mój plan porządków w Figmie i plan sekcji,
>    zanim cokolwiek zmienię. Od fazy 3 możesz wrócić do auto mode, bo tam
>    budujemy według zatwierdzonego planu.
> 2. Otwórz **Figma Desktop** z plikiem projektu i uruchom w nim wtyczkę
>    **Figma Desktop Bridge** (Plugins → Development → Figma Desktop Bridge).
>    Bez niej nie odczytam zmiennych, adnotacji ani drzewa warstw.

Jeśli sesja jest już w plan mode, pomiń punkt 1.

## 2. Konfiguracja projektu

Zapytaj o dane, których brakuje, **jednym pytaniem ze wszystkimi polami**:
- nazwa klienta,
- slug motywu (np. `nazwa-klienta`),
- prefiks kodu: 2–6 małych liter, np. `abc`,
- link do pliku Figmy, najlepiej do ramki desktopowej strony głównej
  (prawy klik na ramce → Copy link to selection).

Potem:

```bash
npm install
npm run setup -- --klient "…" --slug … --prefiks … --figma "<link>"
```

Setup podmienia placeholdery `fwp`/`fwp-motyw` w całym kodzie i zapisuje
`projekt.json`. Uruchamia się jeden raz. Przy `skonfigurowany: true` odmawia.

## 3. Token Figma REST API

Sprawdź, czy `.env` zawiera `FIGMA_TOKEN`. Jeśli nie, poproś właściciela:

> Potrzebuję osobistego tokenu Figma API: Figma → Settings → Security →
> Personal access tokens → Generate, zakres **File content: read**
> (do porządków w fazie 1 wystarczy Bridge, token służy do eksportu grafik).
> Wklej go do pliku `.env` w katalogu projektu jako `FIGMA_TOKEN=figd_…`.
> Plik jest w `.gitignore`.

**Nie proś o wklejenie tokenu do czatu.** Niech właściciel zapisze go w pliku sam.

## 4. WordPress

**Najpierw sprawdź, czy port 8888 jest wolny.** Odpowiada tam WordPress
innego projektu? Preflight uznałby go za ten projekt. Ustaw wtedy osobny port:
`.wp-env.override.json` z `{"port": 8890, "testsPort": 8891}` (plik jest
w `.gitignore`) i ten sam adres w `projekt.json.urlLokalny`
(`http://localhost:8890`).

```bash
npm run env:start
```

Pada na braku `docker compose`? Na macOS z Apple Silicon poprzedź komendę
`export PATH=/opt/homebrew/bin:$PATH` (zob. `CLAUDE.md`).

Następnie:

```bash
npm run wp -- theme activate <slug>
npm run wp -- plugin activate secure-custom-fields
npm run wp -- rewrite structure '/%postname%/' --hard
npm run agentation
```

Ostatnia komenda buduje pasek uwag, który widać tylko lokalnie.

PHPCS do `npm run lint:php` instalujesz przez `npm run php:install`
(composer w kontenerze). Pada na DNS (kontener nie widzi packagist, zdarza się
na Colimie)? Zrestartuj Colimę (`colima restart`) i spróbuj ponownie.
Lint to nie blocker startu: zapisz problem w `docs/stan.md` i idź dalej.

## 5. Preflight

```bash
npm run sprawdz
```

Każde ✖ naprawiasz, zanim pójdziesz dalej. Figma Desktop Bridge sprawdzasz sam:
wywołaj `figma_get_status` z MCP `figma-console`. Wynik musi pokazać połączenie
i **ten sam plik**, co `projekt.json.figma.fileKey`. Inny plik albo brak
połączenia: poproś o otwarcie właściwego pliku i uruchomienie wtyczki,
potem `figma_reconnect`.

MCP `figma-console` w ogóle nie jest dostępne w sesji? To konfiguracja
Claude Code, nie projektu. Poproś właściciela o dodanie serwera
(`npx -y figma-console-mcp@latest` ze zmienną `FIGMA_ACCESS_TOKEN`)
i restart sesji.

## 6. Skille

Sprawdź listę dostępnych skilli. Wymagane:
- `superpowers` (brainstorming, dispatching-parallel-agents,
  systematic-debugging, verification-before-completion),
- `frontend-design`.

Zalecane skille WordPressa, instalowane do projektu:

```bash
npx skills add https://github.com/WordPress/agent-skills --agent claude-code \
  --skill wordpress-router --skill wp-project-triage --skill wp-plugin-development
```

Brakuje wymaganych? Powiedz właścicielowi, jak je włączyć (`/plugin` →
marketplace `claude-plugins-official`). Nie blokuj pracy na zalecanych.

## 7. Zamknięcie fazy

- Utwórz gałąź `strona-glowna`.
- Zaznacz fazę 0 w `docs/stan.md`.
- Commit: `Skonfiguruj projekt {klient}`.
- Powiedz właścicielowi, co działa, i zapowiedz fazę 1: porządki w Figmie,
  które zaczną się od pytania o zgodę na zmiany w pliku.

**Nie uruchamiaj `/init` teraz.** W pustym motywie udokumentowałby domysły.
Jego miejsce jest na końcu fazy 3.
