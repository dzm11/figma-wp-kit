<?php
/**
 * Kolejność sekcji: strona główna i podstrony (widoki).
 *
 * Strona główna ma listę w fwp_home_sections(), każda podstrona we własnym
 * pliku inc/views/{widok}.php (wzór: inc/views/README.md). Tu żyje też
 * rozpoznawanie widoku bieżącej strony i układy na liście „Szablon strony”.
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
 * @return void
 */
function fwp_render_home_sections() {
	fwp_render_sections( fwp_home_sections() );
}

/**
 * Sekcje podstrony (widoku) w kolejności z makiety.
 *
 * Lista leży w osobnym pliku inc/views/{widok}.php, który zwraca tablicę
 * slugów partiali. Każdy widok ma własny plik, więc agenci budujący różne
 * podstrony równolegle nie edytują wspólnego pliku. Widok = szablon
 * „Układ: …” wybrany w panelu albo slug strony (np. „uslugi”), a dla strony
 * błędu — „404”.
 *
 * @param string $view Slug widoku.
 * @return string[] Slugi partiali z template-parts/sections/.
 */
function fwp_view_sections( $view ) {
	$view = sanitize_key( $view );
	$file = FWP_DIR . '/inc/views/' . $view . '.php';

	$sections = ( '' !== $view && file_exists( $file ) ) ? (array) include $file : array();

	return (array) apply_filters( 'fwp_view_sections', $sections, $view );
}

/**
 * Renderuje listę sekcji.
 *
 * Sekcję pomija, gdy jej partial nie istnieje albo gdy wyłączono ją
 * parametrem testu stanu pustego (fwp_section_disabled). Sam partial nadal
 * odpowiada za zniknięcie przy pustych polach — tego stąd nie widać.
 *
 * @param string[] $slugs Slugi partiali z template-parts/sections/.
 * @return void
 */
function fwp_render_sections( $slugs ) {
	foreach ( (array) $slugs as $slug ) {
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

/**
 * Slug bieżącego widoku: „404” dla strony błędu, „home” dla strony głównej,
 * a dla podstrony — jej widok (fwp_page_view()).
 *
 * Sekcje wspólne dla kilku widoków (przedrostek shared-) wybierają po nim
 * treść albo wariant.
 *
 * @return string
 */
function fwp_current_view() {
	if ( is_404() ) {
		return '404';
	}

	if ( is_front_page() ) {
		return 'home';
	}

	return fwp_page_view( get_queried_object_id() );
}

/**
 * Nazwy układów podstron na liście „Szablon strony” w panelu.
 *
 * Widok bez wpisu dostaje etykietę z nazwy pliku („o-nas” → „O nas”),
 * więc tablicę uzupełniasz tylko tam, gdzie nazwa z pliku jest za słaba.
 * Wzór wpisu:
 *
 *     'cennik' => __( 'Cennik', 'fwp-motyw' ),
 *
 * @return array<string, string> Slug widoku => etykieta.
 */
function fwp_view_labels() {
	$labels = array(
		// Wpisy według wzoru z opisu funkcji (slug widoku => etykieta).
	);

	return (array) apply_filters( 'fwp_view_labels', $labels );
}

/**
 * Widok (układ sekcji) strony.
 *
 * Najpierw szablon strony wybrany w panelu („Układ: Cennik” = fwp-view-cennik),
 * potem slug strony. Dzięki temu adres strony można zmienić bez utraty układu,
 * a nowa strona może dostać gotowy układ.
 *
 * @param int $post_id ID strony.
 * @return string Slug widoku albo slug strony (bez pliku widoku: zwykła treść).
 */
function fwp_page_view( $post_id ) {
	$post_id  = (int) $post_id;
	$template = (string) get_page_template_slug( $post_id );

	if ( 0 === strpos( $template, 'fwp-view-' ) ) {
		$view = sanitize_key( substr( $template, strlen( 'fwp-view-' ) ) );

		if ( file_exists( FWP_DIR . '/inc/views/' . $view . '.php' ) ) {
			return $view;
		}
	}

	return sanitize_key( (string) get_post_field( 'post_name', $post_id ) );
}

/**
 * Czy strona ma układ sekcji motywu (a nie zwykłą treść z edytora).
 *
 * Strona główna ma układ zawsze (front-page.php).
 *
 * @param int $post_id ID strony.
 * @return bool
 */
function fwp_page_has_view( $post_id ) {
	if ( (int) get_option( 'page_on_front' ) === (int) $post_id ) {
		return true;
	}

	$view = fwp_page_view( $post_id );

	return '' !== $view && file_exists( FWP_DIR . '/inc/views/' . $view . '.php' );
}

/**
 * Dodaje układy z inc/views/*.php do listy „Szablon strony” w panelu.
 *
 * To wirtualne szablony: nie ma plików fwp-view-*.php, wszystkie renderuje
 * page.php przez fwp_page_view(). Widok „404” nie jest układem strony.
 *
 * @param array<string, string> $templates Szablony stron.
 * @return array<string, string>
 */
function fwp_view_page_templates( $templates ) {
	$labels = fwp_view_labels();

	foreach ( glob( FWP_DIR . '/inc/views/*.php' ) as $file ) {
		$slug = basename( $file, '.php' );

		if ( '404' === $slug ) {
			continue;
		}

		$label = isset( $labels[ $slug ] )
			? (string) $labels[ $slug ]
			: ucfirst( str_replace( array( '-', '_' ), ' ', $slug ) );

		/* translators: %s: nazwa układu podstrony. */
		$templates[ 'fwp-view-' . $slug ] = sprintf( __( 'Układ: %s', 'fwp-motyw' ), $label );
	}

	return $templates;
}
add_filter( 'theme_page_templates', 'fwp_view_page_templates' );

/**
 * Wyłącza edytor blokowy na stronach z układem motywu.
 *
 * Treść takiej strony to pola sekcji, nie bloki — edytor blokowy tylko
 * sugerowałby redakcji, że coś w nim zmieni.
 *
 * @param bool    $use_block_editor Czy użyć edytora blokowego.
 * @param WP_Post $post             Edytowany wpis.
 * @return bool
 */
function fwp_view_disable_block_editor( $use_block_editor, $post ) {
	if ( $post && 'page' === $post->post_type && fwp_page_has_view( $post->ID ) ) {
		return false;
	}

	return $use_block_editor;
}
add_filter( 'use_block_editor_for_post', 'fwp_view_disable_block_editor', 10, 2 );

/**
 * Chowa pole treści na stronach z układem motywu — zostają tylko pola sekcji.
 *
 * @param WP_Post $post Edytowana strona.
 * @return void
 */
function fwp_view_remove_editor( $post ) {
	if ( fwp_page_has_view( $post->ID ) ) {
		remove_post_type_support( 'page', 'editor' );
	}
}
add_action( 'add_meta_boxes_page', 'fwp_view_remove_editor' );
