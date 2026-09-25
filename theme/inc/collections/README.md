# Funkcje dostępu do kolekcji

Kolekcja to typ treści z elementami powtarzanymi w wielu sekcjach (osoby,
opinie, pytania, pozycje listy). Typ rejestrujesz wpisem w
`fwp_register_collections()` (`inc/cms.php`) albo filtrem `fwp_collections`.
Tutaj leżą **funkcje, przez które partiale czytają kolekcję**.

Każdy plik `*.php` z tego katalogu jest dołączany automatycznie przez
`inc/cms.php` — zawsze, także bez wtyczki SCF, bo wołają go partiale. Ten
`README.md` nie jest wczytywany — to tylko wzór.

## Zasady

- **Jeden plik na typ**: `inc/collections/{typ}.php`. Agenci budujący różne
  sekcje nie edytują wspólnego pliku.
- Funkcja zwraca tablice w kształcie, którego używa partial (a nie `WP_Post`),
  np. `fwp_get_osoby()` → `array( array( 'name' => …, 'role' => … ) )`.
  Partial z treścią z makiety na sztywno ma już taką pętlę — po podpięciu CMS
  zmienia się tylko źródło tablicy.
- Kolejność z panelu: `fwp_collection( $typ )` sortuje po Atrybuty → Kolejność
  (`menu_order`), potem po dacie.
- Metę czytaj przez `get_post_meta()`, nie `get_field()` — plik działa też
  bez wtyczki.
- Wpis bez wymaganej treści pomiń. Pusta kolekcja daje pustą tablicę: sekcja
  chowa listę albo znika cała.
- Pola wpisu kolekcji to osobna grupa w `inc/fields/cpt-{typ}.php`
  z lokalizacją `post_type == {typ}`.

## Wzór: `inc/collections/osoba.php`

```php
<?php
/**
 * Kolekcja „osoba”: funkcje dostępu dla sekcji z listą osób.
 *
 * Wpis: tytuł = imię i nazwisko, pole osoba_rola (inc/fields/cpt-osoba.php),
 * zdjęcie = obrazek wyróżniający.
 *
 * @package fwp-motyw
 */

defined( 'ABSPATH' ) || exit;

/**
 * Osoby w kształcie używanym przez partiale sekcji.
 *
 * @param int $limit Maksymalna liczba osób, 0 = bez limitu.
 * @return array[] Lista tablic: id, name, role, image (ID załącznika).
 */
function fwp_get_osoby( $limit = 0 ) {
	$out = array();

	foreach ( fwp_collection( 'osoba' ) as $post ) {
		$name = trim( (string) $post->post_title );
		if ( '' === $name ) {
			continue;
		}

		$out[] = array(
			'id'    => (int) $post->ID,
			'name'  => $name,
			'role'  => (string) get_post_meta( $post->ID, 'osoba_rola', true ),
			'image' => (int) get_post_thumbnail_id( $post ),
		);

		if ( $limit > 0 && count( $out ) >= $limit ) {
			break;
		}
	}

	return $out;
}
```

W partialu pusta kolekcja chowa sekcję — kolekcja nie ma fallbacku w kodzie,
bo „brak wpisów” i „redakcja usunęła wszystkie” wyglądają tak samo. Treść
z makiety trafia do kolekcji jako wpisy w fazie CMS: idempotentny skrypt
startowy (dopasowuje wpis po tytule, istniejących nie nadpisuje) uruchamiany
przez `wp eval-file` w kontenerze.

```php
$fwp_people = fwp_get_osoby();

if ( ! $fwp_people ) {
	return;
}
```

Zdjęcie: `fwp_image( $person['image'], 'people/placeholder.jpg', $person['name'], array( 'width' => 320, 'height' => 400 ) )`.
