---
name: kit-wdrozenie
description: Faza 8 frameworka Figma → WordPress. Wystawia podgląd dla klienta na serwerze z SSH. Motyw, pluginy mu, media i baza przez npm run deploy, blokada robotów na adresie podglądowym i weryfikacja curlem. Użyj, gdy właściciel chce pokazać stronę klientowi.
---

# Faza 8: wdrożenie podglądu

Cel: link, który właściciel wyśle klientowi, a który nie trafi do Google.
Szczegóły hostingu są w `docs/wdrozenie.md`.

## 1. Dane dostępowe

`.env.deploy` (wzór w `.env.deploy.example`) uzupełnia właściciel. Hasło
nie trafia ani do pliku, ani do czatu. Logowanie idzie kluczem SSH. Brak klucza?
Podaj właścicielowi komendy `ssh-keygen` i dodania klucza w panelu hostingu.

Pierwszy raz na serwerze: `npm run deploy -- bootstrap` instaluje WP-CLI
w katalogu domowym. WordPress na serwerze musi już istnieć, bo instaluje
go panel hostingu.

W `.env.deploy` ustaw też `DEPLOY_ADMIN_USER` i `DEPLOY_ADMIN_PASS` (hasło
admina na podglądzie, baza lokalna ma `admin / password`) oraz `DEPLOY_LOCALE`
(język panelu i strony). Skrypt stosuje je po każdym imporcie treści.

**Subdomeny podglądu.** Podglądy kolejnych klientów na własnej domenie
agencji? Dodaj raz rekord DNS `*` (wildcard) wskazujący na serwer. Potem nowy
podgląd to tylko subdomena w panelu hostingu i certyfikat, bez czekania na
propagację DNS.

**Cudzy hosting** (konto klienta, na którym stoją inne strony): nie dostajesz
pełnego SSH do całego konta. Wybierz jedno:
- osobne konto (albo podkonto) hostingu tylko na podgląd,
- klucz SSH ograniczony w `authorized_keys` do rsync w jednym katalogu:
  `command="rrsync /ścieżka/do/podglądu",restrict ssh-ed25519 …`. Wtedy
  WP-CLI zdalnie nie działa i kroki bazy robi właściciel albo panel,
- osobny użytkownik bazy z uprawnieniami tylko do bazy podglądu.

Zapisz wybór w `docs/wdrozenie.md`.

## 2. Blokada robotów, przed pierwszym wysłaniem treści

1. Dopisz host podglądu (i techniczną domenę hostingu, jeśli przekierowuje)
   do listy na górze `mu-plugins/{prefiks}-noindex-preview.php`.
2. `npm run deploy -- mu`.
3. Dopisz na serwerze na początku `.htaccess` nagłówek dla plików
   statycznych (treść w `docs/wdrozenie.md`). Plugin obejmuje tylko
   odpowiedzi WordPressa, a obrazy i arkusze serwuje Apache.

Co daje ta konfiguracja:
- `robots.txt` z `Disallow: /`, żeby roboty nie chodziły po podglądzie,
- noindex w nagłówku i meta jako druga warstwa,
- wyłączoną mapę strony.

Ograniczenie: adres podlinkowany z zewnątrz może się pojawić w Google bez
opisu, bo zablokowany robot nie widzi noindex. Pełną blokadę daje tylko
hasło HTTP. Zaproponuj je, jeśli klient ma coś do ukrycia.

**Produkcyjnej domeny klienta nie wpisuj na listę nigdy.** Lista jest jawna
i wąska właśnie po to, żeby pomyłka w konfiguracji nie wyciszyła prawdziwej
strony.

## 3. Wysyłka

```bash
npm run deploy -- theme
npm run deploy -- media
npm run deploy -- content   # NADPISUJE bazę na serwerze
npm run deploy -- agentation  # pasek uwag na podglądzie
```

- **Motyw idzie z `git archive HEAD`**, nie z drzewa roboczego. Wdrażasz to,
  co zacommitowane, więc niedokończone pliki równolegle pracujących agentów
  nie trafią na serwer. Zmiana ma być na podglądzie? Najpierw commit.
- **Po imporcie treści** skrypt ustawia `blog_public 0`, hasło admina
  z `.env.deploy` i język (`DEPLOY_LOCALE`). Import bazy nadpisuje wszystkie
  trzy wartościami lokalnymi, więc to nie jest krok jednorazowy.
- **Rozgrzej strony** po imporcie: odwiedź raz każdy adres (strona główna
  i `path` z `nodes.json`, `curl -s -o /dev/null`). Pierwsze wyświetlenie
  wczytuje listy z makiety do pustych repeaterów w panelu (zob. `kit-cms`).
  Bez tego redaktor zobaczy w panelu puste listy.
- **Pasek uwag na podglądzie.** Działa lokalnie i w środowisku `staging`,
  nigdy na produkcji. Na serwerze podglądu ustaw w `wp-config.php`
  `define( 'WP_ENVIRONMENT_TYPE', 'staging' );` i wyślij bundle przez
  `npm run deploy -- agentation` (zbudowany wcześniej `npm run agentation`).
  Wdrożenie motywu go nie kasuje. Na domenę produkcyjną bundla nie wysyłasz.

**Bramka przed `content`:** zapytaj właściciela wprost, czy nadpisać bazę
na serwerze. Skrypt i tak pyta o „tak”, ale ty też nie zakładasz zgody.
Zgoda z poprzedniego wdrożenia nie przechodzi na kolejne.

## 4. Weryfikacja na żywo

```bash
curl -s https://{host}/robots.txt                        # Disallow: /
curl -sI https://{host}/ | grep -i x-robots              # noindex…
curl -s https://{host}/ | grep -io '<meta[^>]*robots[^>]*>'   # jeden znacznik
curl -s -o /dev/null -w '%{http_code}' https://{host}/wp-sitemap.xml  # 404
```

Do tego: obraz z motywu ma nagłówek `x-robots-tag`, strona w szerokości ramek z `projekt.json` (`figma.ramki`, zwykle desktop i 393)
wygląda jak lokalnie, a w konsoli nie ma błędów 403 ani 404 dla arkuszy
i obrazów. Błąd 403 na plikach to uprawnienia. Skrypt prostuje je po stronie
serwera. Jeśli nie pomogło, sprawdź, czy katalog nie ma 700.

Zaznacz fazę w `docs/stan.md`. Commit `Wdróż podgląd {host}`, jeśli coś
się zmieniło w repo.
