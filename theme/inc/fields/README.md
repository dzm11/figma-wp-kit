# Grupy pól SCF

Każdy plik `*.php` w tym katalogu jest wczytywany automatycznie przez
`fwp_load_field_groups()` z `inc/options.php` (hak `acf/include_fields`).
Nie trzeba go nigdzie rejestrować. Ten plik `README.md` nie jest wczytywany —
to tylko wzór.

Zasady:

- Grupy pól definiujemy **wyłącznie w kodzie** przez `acf_add_local_field_group()`,
  nigdy klikając w panelu. Definicja z bazy nie da się wersjonować, a przy
  równoległej pracy nad sekcjami kolidowałaby.
- Jeden plik na sekcję: `home-{slug}.php`, obok partiala
  `template-parts/sections/home-{slug}.php`.
- Klucze (`group_…`, `field_…`) muszą być globalnie unikalne i **stałe** —
  zmiana klucza odcina wartości już zapisane w bazie.
- Lokalizację wiąż z typem strony (`page_type == front_page`), nie z ID
  strony. ID różni się między środowiskiem lokalnym a produkcją.
- Szablon czyta pola przez `fwp_field( 'nazwa', 'treść z makiety' )`: sekcja
  renderuje się od razu z treścią z Figmy, a pole w CMS ją nadpisuje.

## Wzór: `inc/fields/home-hero.php`

```php
<?php
/**
 * Pola sekcji „Hero” na stronie głównej.
 *
 * @package fwp-motyw
 */

defined( 'ABSPATH' ) || exit;

acf_add_local_field_group(
	array(
		'key'      => 'group_fwp_home_hero',
		'title'    => __( 'Strona główna — Hero', 'fwp-motyw' ),
		'location' => array(
			array(
				array(
					'param'    => 'page_type',
					'operator' => '==',
					'value'    => 'front_page',
				),
			),
		),
		'fields'   => array(
			array(
				'key'   => 'field_fwp_home_hero_title',
				'name'  => 'hero_title',
				'label' => __( 'Tytuł', 'fwp-motyw' ),
				'type'  => 'text',
			),
			array(
				'key'        => 'field_fwp_home_hero_items',
				'name'       => 'hero_items',
				'label'      => __( 'Elementy', 'fwp-motyw' ),
				'type'       => 'repeater',
				'layout'     => 'block',
				'sub_fields' => array(
					array(
						'key'   => 'field_fwp_home_hero_item_label',
						'name'  => 'label',
						'label' => __( 'Etykieta', 'fwp-motyw' ),
						'type'  => 'text',
					),
				),
			),
		),
	)
);
```

Pola wspólne dla całej witryny (kontakt, stopka) przypinasz do strony opcji:

```php
'location' => array(
	array(
		array(
			'param'    => 'options_page',
			'operator' => '==',
			'value'    => 'fwp-ustawienia',
		),
	),
),
```

i czytasz przez `fwp_field( 'nazwa', '', 'option' )`.

## Wzór partiala: `template-parts/sections/home-hero.php`

```php
<?php
/**
 * Sekcja „Hero” strony głównej.
 *
 * @package fwp-motyw
 */

defined( 'ABSPATH' ) || exit;

fwp_enqueue_section_style( 'home-hero' );

$fwp_title = (string) fwp_field( 'hero_title', __( 'Tytuł z makiety', 'fwp-motyw' ) );

// Sekcja znika, gdy nie ma czego pokazać — nigdy pusta ramka.
if ( '' === $fwp_title ) {
	return;
}
?>
<section class="fwp-hero">
	<div class="fwp-container">
		<h1 class="fwp-hero__title"><?php echo esc_html( $fwp_title ); ?></h1>
	</div>
</section>
```
