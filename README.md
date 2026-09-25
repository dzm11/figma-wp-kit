# figma-wp-kit

Framework do przenoszenia stron z Figmy do WordPressa z Claude Code.
Dedykowany motyw klasyczny (PHP + Secure Custom Fields), wierność weryfikowana
pomiarem wobec makiety, uwagi zgłaszane kliknięciem w stronę.

Powstał z pierwszego projektu przeniesionego tą metodą (w `LEKCJE.md` jako „Projekt A”). Co tam kosztowało czas i jak framework temu
zapobiega, opisuje `LEKCJE.md`.

## Czego potrzebujesz

- **Claude Code** z pluginami `superpowers` i `frontend-design`
  (`/plugin` → marketplace `claude-plugins-official`).
- **Figma Desktop** z wtyczką **Figma Desktop Bridge** i serwerem MCP
  `figma-console` w Claude Code (`npx -y figma-console-mcp@latest`
  ze zmienną `FIGMA_ACCESS_TOKEN`).
- **Osobisty token Figma REST API**: Figma → Settings → Security →
  Personal access tokens, zakres *File content: read*.
- **Node 20+** i **Docker** (WordPress stoi w wp-env). PHP, Composer ani WP-CLI
  nie są potrzebne lokalnie.

## Nowy projekt w pięciu krokach

```bash
git clone https://github.com/dzm11/figma-wp-kit.git ~/Projekty/nazwa-klienta
cd ~/Projekty/nazwa-klienta
git remote rename origin kit        # zostaw łącze do frameworka na aktualizacje
claude
```

Do rozwijania samego frameworka trzymaj osobny klon w `~/figma-wp-kit`.
Tam faza 9 odkłada poprawki (ścieżka w `projekt.json` → `kit.sciezka`).

1. W Claude Code przełącz się na **plan mode** (Shift+Tab). Zostań w nim przez
   fazy 0–2: zobaczysz plan porządków w Figmie i plan sekcji, zanim
   cokolwiek się zmieni.
2. Otwórz plik w Figma Desktop i uruchom **Figma Desktop Bridge**.
3. Wpisz **`/kit-start`**. Claude poprosi o nazwę klienta, prefiks, slug
   i link do Figmy, skonfiguruje projekt i postawi WordPressa.
4. Zapisz token w pliku `.env` jako `FIGMA_TOKEN=figd_…`, gdy Claude o to
   poprosi. Nie wklejaj go do czatu.
5. Od tej pory w każdej sesji wystarczy **`/kit`**. Claude sprawdzi stan
   i poprowadzi następną fazę.

## Fazy

Zawsze zaczynamy od strony głównej.

| # | Faza | Twój udział |
|---|---|---|
| 0 | Start | dane klienta, token, Bridge |
| 1 | Porządki w Figmie: nazwy warstw, adnotacje, komponenty, audyt | zgoda na zmiany w pliku (kopia albo oryginał) |
| 2 | Rekonesans: tokeny, kontrakty sekcji, grafiki, pytania | zatwierdzasz plan sekcji |
| 3 | Fundament: siatka, komponenty, sekcja wzorcowa | nic; od tej fazy możesz wrócić do auto mode |
| 4 | Szkic całości: wszystkie sekcje równolegle | przegląd strony |
| 5 | Uwagi | klikasz uwagi paskiem Agentation |
| 6 | CMS | nic |
| 7 | Testy | nic |
| 8 | Wdrożenie podglądu | dane SSH, zgoda na nadpisanie bazy |
| 9 | Lekcje do frameworka | zatwierdzasz poprawki frameworka |

Kolejny widok: `/kit` z nazwą widoku, np. „przenieś widok Kontakt”.
Fundament jest już gotowy, więc idzie szybciej. Kilka widoków naraz Claude
prowadzi workflowem (rekonesans i budowa potokiem per widok).

Chcesz, żeby pracował bez zatrzymywania się (np. przez noc)? Napisz „nie
zatrzymuj się, wybieraj rekomendowane”. Decyzje z bramek trafią do rejestru,
a na końcu dostaniesz jedno podsumowanie.

**Docker:** przy pracy równoległej maszyna Dockera potrzebuje co najmniej
6 GB RAM i 4 CPU.

**Brak makiety mobilnej nie blokuje pracy.** Claude projektuje mobile według
reguł w `.claude/skills/kit-sekcje/mobile.md` i oznacza to w rejestrze jako
„wymyślone”. Oceniasz to w fazie uwag.

## Jak zgłaszać uwagi

Na `http://localhost:8888`, w prawym dolnym rogu, jest pasek **Agentation**
(lokalnie i na podglądzie w środowisku `staging`, nigdy na produkcji):

1. Kliknij ikonę, potem element na stronie.
2. Wpisz uwagę: „za duży odstęp”, „jak w Figmie”, „ten przycisk kwadratowy”.
3. Powtórz dla wszystkich uwag, także na wąskim oknie.
4. **Copy**, wklej Claude'owi.

Claude rozbierze paczkę na pliki, zrealizuje ją równolegle i odda tabelę
„uwaga → co zmieniono”. Uwagi odbiegające od makiety trafiają do
`docs/decyzje/rejestr.md`, żeby nikt ich później nie „naprawił” z powrotem.

## Co jest w środku

```
CLAUDE.md                  zasady, fazy, konwencje, pułapki (czyta Claude)
LEKCJE.md                  lekcje z projektów, rośnie z każdym klientem
projekt.json               klient, prefiks, slug, plik Figmy, szerokości testowe
.claude/skills/kit*        skill na każdą fazę + brief sekcji, reguły mobile, szablon kontraktu
docs/stan.md               które fazy zrobione (pamięć między sesjami)
docs/decyzje/rejestr.md    odejścia od makiety, wymyślone, ustalenia
docs/figma/                tokens.json, nodes.json, kontrakty sekcji, referencje
docs/wdrozenie.md          hosting z SSH, blokada robotów na podglądzie
theme/                     szkielet motywu (siatka, helpery, ładowanie sekcji)
mu-plugins/                blokada indeksowania podglądu, adres z tunelu
tools/                     setup, preflight, tokeny, eksport z Figmy, porównanie, obrazy, fonty, wdrożenie, Agentation
```

## Framework się uczy

Faza 9 zbiera to, co w projekcie poszło źle, i przygotowuje poprawki
w repozytorium frameworka (`projekt.json` → `kit.sciezka`) na osobnej gałęzi.
Scalasz je sam, po przejrzeniu.

Świeże skille z frameworka ściągniesz do trwającego projektu tak:

```bash
git fetch kit
git checkout kit/main -- .claude/skills LEKCJE.md
```

Kodu (`theme/`, `tools/`) tak nie aktualizuj: setup podmienił w nim prefiks.
Poprawki narzędzi przenoś ręcznie albo poproś o to Claude.
