<?php
/**
 * Kolejność sekcji strony głównej.
 *
 * @package fwp-motyw
 */

defined( 'ABSPATH' ) || exit;

/**
 * Slugi sekcji strony głównej w kolejności z makiety — jedyne miejsce,
 * w którym ta kolejność istnieje.
 *
 * Wpisz tu pełną listę sekcji, ZANIM zaczniesz je budować równolegle:
 * slug bez pliku template-parts/sections/{slug}.php jest po cichu pomijany,
 * więc lista może wyprzedzać kod, a pojedyncza sekcja nie musi już dotykać
 * tego pliku. Filtr fwp_home_sections zostaje dla wtyczek i testów.
 *
 * @return string[] Np. array( 'home-hero', 'home-clients', 'home-news' ).
 */
function fwp_home_sections() {
	$sections = array(
		// Uzupełnij slugami sekcji z makiety, np. 'home-hero'.
	);

	return (array) apply_filters( 'fwp_home_sections', $sections );
}

/**
 * Renderuje sekcje strony głównej w kolejności z fwp_home_sections().
 *
 * Sekcję pomija, gdy jej partial nie istnieje albo gdy wyłączono ją
 * parametrem testu stanu pustego (fwp_section_disabled). Sam partial nadal
 * odpowiada za zniknięcie przy pustych polach — tego stąd nie widać.
 *
 * @return void
 */
function fwp_render_home_sections() {
	foreach ( fwp_home_sections() as $slug ) {
		$slug = sanitize_key( $slug );

		if ( '' === $slug || fwp_section_disabled( $slug ) ) {
			continue;
		}

		$template = 'template-parts/sections/' . $slug;

		if ( '' === locate_template( $template . '.php' ) ) {
			continue;
		}

		get_template_part( $template );
	}
}
