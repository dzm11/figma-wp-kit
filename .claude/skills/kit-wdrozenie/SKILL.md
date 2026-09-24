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
```

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
