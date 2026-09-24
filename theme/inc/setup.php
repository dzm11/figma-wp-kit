<?php
/**
 * Konfiguracja motywu.
 *
 * @package fwp-motyw
 */

defined( 'ABSPATH' ) || exit;

/**
 * Rejestruje wsparcie dla funkcji WordPressa i menu.
 *
 * Rozmiary obrazków (add_image_size) dopisuj tutaj, dopiero gdy znasz
 * proporcje kart z makiety — zgadnięty rozmiar i tak trzeba będzie
 * przegenerować.
 *
 * @return void
 */
function fwp_setup() {
	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'html5', array( 'search-form', 'gallery', 'caption', 'style', 'script' ) );
	add_theme_support( 'responsive-embeds' );

	register_nav_menus(
		array(
			'primary' => __( 'Menu główne', 'fwp-motyw' ),
			'footer'  => __( 'Menu w stopce', 'fwp-motyw' ),
		)
	);
}
add_action( 'after_setup_theme', 'fwp_setup' );
