<?php
/**
 * Strona ustawień witryny i wczytywanie grup pól SCF.
 *
 * @package fwp-motyw
 */

defined( 'ABSPATH' ) || exit;

/**
 * Rejestruje stronę opcji na ustawienia wspólne dla całej witryny
 * (dane kontaktowe, media społecznościowe, stopka). Same pola dokłada
 * grupa w inc/fields/ z lokalizacją options_page == fwp-ustawienia.
 *
 * Strony opcji w Secure Custom Fields są za darmo — w ACF wymagałyby wersji Pro.
 *
 * @return void
 */
function fwp_register_options_page() {
	if ( ! function_exists( 'acf_add_options_page' ) ) {
		return;
	}

	acf_add_options_page(
		array(
			'page_title' => __( 'Ustawienia witryny', 'fwp-motyw' ),
			'menu_title' => __( 'Ustawienia witryny', 'fwp-motyw' ),
			'menu_slug'  => 'fwp-ustawienia',
			'capability' => 'manage_options',
			'position'   => 30,
			'icon_url'   => 'dashicons-admin-settings',
			'redirect'   => false,
		)
	);
}
add_action( 'acf/init', 'fwp_register_options_page' );

/**
 * Wczytuje wszystkie definicje grup pól z inc/fields/*.php.
 *
 * Grupy pól żyją w kodzie (acf_add_local_field_group), nigdy w bazie —
 * inaczej nie da się ich wersjonować ani budować sekcji równolegle.
 * Wczytujemy katalogiem, a nie listą, żeby dodanie sekcji nie wymagało
 * dopisywania jej w dwóch miejscach. Wzór pliku: inc/fields/README.md.
 *
 * @return void
 */
function fwp_load_field_groups() {
	if ( ! function_exists( 'acf_add_local_field_group' ) ) {
		return;
	}

	foreach ( glob( FWP_DIR . '/inc/fields/*.php' ) as $file ) {
		require_once $file;
	}
}
add_action( 'acf/include_fields', 'fwp_load_field_groups' );
