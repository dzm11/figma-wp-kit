# Wdrożenie na serwer zdalny

`npm run deploy` (skrypt `tools/deploy.sh`) wysyła motyw, pluginy mu, media
i bazę na hosting z dostępem **SSH**. Bez powłoki nie ma WP-CLI, a bez WP-CLI
nie da się bezpiecznie podmienić adresów w bazie — dlatego SSH jest wymogiem
przy wyborze hostingu, nie udogodnieniem.

Przykład w tym dokumencie to **MyDevil**: ma SSH na wszystkich planach,
ale nie ma Dockera, wdrożenia z Gita ani globalnego WP-CLI. Na innym hostingu
z SSH kroki są te same, różnią się ścieżki i panel.

## Zanim zaczniesz

W panelu hostingu:

1. Utwórz domenę albo subdomenę dla projektu.
2. **Ustaw PHP 8.2** — tę wersję ma środowisko lokalne (`.wp-env.json`).
3. Utwórz bazę MySQL i zapisz dane dostępowe.
4. Zainstaluj WordPressa w katalogu domeny (instalator w panelu albo ręcznie).
5. Wygeneruj certyfikat Let's Encrypt.

Po zalogowaniu przez SSH wejdź do katalogu domeny i sprawdź ścieżkę
poleceniem `pwd` — będzie potrzebna w konfiguracji. Na MyDevil wygląda tak:
`/usr/home/UZYTKOWNIK/domains/DOMENA/public_html`.

## Konfiguracja jednorazowa

```bash
cp .env.deploy.example .env.deploy
```

Uzupełnij `.env.deploy` danymi z panelu. Plik jest w `.gitignore`
i **nigdy nie trafia do repozytorium**.

Następnie zainstaluj WP-CLI na serwerze:

```bash
npm run deploy -- bootstrap
```

Skrypt pobiera `wp-cli.phar` do `~/bin/wp` i wypisuje wersję. Robisz to raz.

## Wdrożenie

```bash
npm run deploy -- theme      # sam motyw, najczęstszy przypadek
npm run deploy -- mu         # pluginy mu (blokada robotów, tunel)
npm run deploy -- media      # biblioteka mediów
npm run deploy -- content    # baza danych — NADPISUJE zdalną
npm run deploy -- all        # wszystko naraz
```

Motyw ląduje w `wp-content/themes/<slug>`, gdzie `<slug>` pochodzi
z `projekt.json`. Po pierwszym pełnym wdrożeniu w panelu WordPressa:

1. Włącz motyw (nazwa klienta z `projekt.json`).
2. Zainstaluj wtyczkę **Secure Custom Fields** z repozytorium wordpress.org.
   Grupy pól są w kodzie motywu i pojawią się same — nie klikaj ich ręcznie.

## Co robi każda komenda i dlaczego tak

**`theme`** wysyła katalog `theme/` przez `rsync`, więc leci tylko to, co się
zmieniło. Pomija `tests/`, `vendor/` (narzędzia lintera), pliki
deweloperskie i bundle paska Agentation — narzędzia, które nie ma prawa
znaleźć się na serwerze (i tak ładuje się tylko lokalnie).

**`mu`** wysyła `mu-plugins/`. To kod, który ma działać niezależnie od
aktywnego motywu — przede wszystkim blokada robotów na podglądzie.

**`media`** wyciąga pliki z kontenera Dockera tego projektu i wysyła je
do `wp-content/uploads`. Media nie są w repozytorium, bo to binaria
wrzucone przez WordPressa. Kontener jest wskazywany po katalogu instalacji
`wp-env`, więc kilka projektów uruchomionych naraz nie myli się ze sobą.

**`content`** eksportuje bazę lokalną, wysyła ją i importuje zdalnie, a potem
podmienia adresy przez `wp search-replace`. **Nie da się tego zrobić zwykłym
„znajdź i zamień” po pliku SQL** — WordPress trzyma część danych zserializowanych,
a podmiana tekstem psuje w nich zapisane długości ciągów i wysypuje pola.
Komenda pyta o potwierdzenie, bo nadpisuje całą zdalną bazę.

**Uprawnienia** po każdej wysyłce prostuje skrypt po stronie serwera
(`find … chmod 755/644`), a nie `rsync --chmod`: rsync dostarczany z macOS
jest w wersji 2.6.9 i tej opcji nie zna. Bez tego kroku katalog z lokalnymi
uprawnieniami 700 daje na hostingu 403 przy każdym pliku — media i arkusze
po prostu się nie wczytują.

## Blokada robotów na podglądzie

Adres podglądowy (subdomena u hostingu, adres tymczasowy) nie może trafić
do wyszukiwarek — inaczej konkuruje potem z produkcyjną domeną klienta.
Blokada jest jawną listą hostów, a nie warunkiem „wszystko poza produkcją”:
pomyłka w konfiguracji nie wyciszy wtedy prawdziwej strony.

### 1. Wpisz host do mu-pluginu

W `mu-plugins/<prefiks>-noindex-preview.php` na górze pliku jest stała
z listą hostów — domyślnie pusta. Dopisz nazwę hosta podglądu (bez schematu
i portu, małymi literami):

```php
const FWP_NOINDEX_HOSTS = array(
	'klient.podglad.example.net',
);
```

(prefiks stałej po `npm run setup` jest prefiksem projektu). Wyślij:
`npm run deploy -- mu`. Na tych hostach plugin:

- zastępuje robots.txt treścią `User-agent: *` / `Disallow: /`,
- dodaje `noindex, nofollow, noarchive, nosnippet` do znacznika meta robots
  (przez filtr `wp_robots`, usuwając `max-image-preview` — inaczej w `<head>`
  byłyby dwie sprzeczne dyrektywy),
- ustawia nagłówek HTTP `X-Robots-Tag`,
- wyłącza mapę strony (`wp-sitemap.xml`).

Kompromis: robot, któremu robots.txt zabrania wejścia, nie zobaczy `noindex`,
więc adres podlinkowany z zewnątrz może trafić do wyników — bez opisu.
Pełną blokadą byłoby tylko hasło HTTP, ale wtedy klient nie obejrzy podglądu
bez logowania.

### 2. Nagłówek dla plików statycznych w `.htaccess`

Obrazy, PDF-y i arkusze serwuje bezpośrednio Apache, z pominięciem PHP —
mu-plugin ich nie widzi. Na serwerze podglądu dopisz na **początku**
`.htaccess` w katalogu WordPressa (przed blokiem `# BEGIN WordPress`, który
WordPress przepisuje):

```apache
<IfModule mod_headers.c>
	Header set X-Robots-Tag "noindex, nofollow, noarchive, nosnippet"
</IfModule>
```

Tego wpisu **nie kopiuj na produkcję** — tam wyciszyłby całą stronę.

### 3. Weryfikacja

```bash
HOST=https://klient.podglad.example.net

curl -s "$HOST/robots.txt"                                  # Disallow: /
curl -sI "$HOST/" | grep -i x-robots-tag                   # noindex, nofollow, …
curl -s "$HOST/" | grep -i '<meta name=.robots'            # noindex, nofollow, …
curl -sI "$HOST/wp-content/themes/<slug>/style.css" | grep -i x-robots-tag
curl -s -o /dev/null -w '%{http_code}\n' "$HOST/wp-sitemap.xml"   # 404
```

Na produkcji te same polecenia **nie** powinny pokazać `noindex` ani `Disallow: /`.

## Przy kolejnych aktualizacjach

Zwykle wystarczy `npm run deploy -- theme`. Bazę wysyłaj **tylko wtedy, gdy
treść jest źródłowo u Ciebie lokalnie**. Jeśli klient zacznie edytować treść
na serwerze, `content` skasuje jego zmiany — od tego momentu kierunek
przepływu treści się odwraca i trzeba ściągać bazę z serwera, a nie wysyłać.

## Czego ten skrypt nie robi

- **Nie tworzy kopii zapasowej** przed importem bazy. Zrób ją w panelu
  hostingu albo dopisz krok `wp db export` po stronie zdalnej.
- Nie instaluje WordPressa ani wtyczek — to jednorazowe kroki z panelu.
- Nie obsługuje kilku środowisk naraz (podgląd + produkcja). Gdy będą dwa,
  potrzebna jest druga konfiguracja i przełącznik środowiska.
