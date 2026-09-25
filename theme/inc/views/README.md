# Listy sekcji podstron (widoki)

Jeden plik na widok: `inc/views/{widok}.php` zwraca tablicę slugów partiali
z `template-parts/sections/` w kolejności z makiety. Ten `README.md` nie jest
wczytywany — to tylko wzór.

## Wzór: `inc/views/uslugi.php`

```php
<?php
/**
 * Sekcje widoku „uslugi” w kolejności z makiety (inc/views/README.md).
 *
 * @package fwp-motyw
 */

defined( 'ABSPATH' ) || exit;

return array(
	'uslugi-hero',
	'uslugi-lista',
	'shared-kontakt',
);
```

## Jak widok trafia na stronę

- `page.php` pyta `fwp_page_view()` o widok strony: najpierw szablon
  „Układ: …” wybrany w panelu (wartość `fwp-view-{widok}`), potem slug strony.
  Adres strony można więc zmienić bez utraty układu, a nowa strona dostaje
  gotowy układ z listy.
- Każdy plik z tego katalogu (poza `404.php`) pojawia się na liście
  „Szablon strony” jako „Układ: {etykieta}”. Etykieta pochodzi z nazwy pliku
  (`o-nas` → „O nas”), a lepszą nazwę dopisujesz w `fwp_view_labels()`
  (`inc/sections.php`) albo filtrem `fwp_view_labels`.
- Strona z układem nie ma edytora blokowego ani pola treści — jej treść to
  pola sekcji (reguła lokalizacji SCF `fwp_view`, zob. `inc/cms.php`).
- Strona bez pliku widoku pokazuje zwykłą treść z edytora.
- `404.php` (szablon motywu) renderuje widok `404`, jeśli istnieje
  `inc/views/404.php`; inaczej prosty komunikat.
- `fwp_current_view()` zwraca widok bieżącej strony (`home` dla strony
  głównej, `404` dla strony błędu).

## Zasady

- Slug bez partiala jest pomijany, więc lista może wyprzedzać kod.
- Plik widoku należy do agenta budującego ten widok — dzięki temu widoki
  powstają równolegle bez edycji wspólnego pliku.
- Partiale widoku mają przedrostek widoku (`uslugi-hero`), sekcje wspólne dla
  kilku widoków — przedrostek `shared-`. Sekcja wspólna rozróżnia widoki przez
  `fwp_current_view()`.
- Strona główna nie ma pliku w tym katalogu: jej lista to `fwp_home_sections()`.
