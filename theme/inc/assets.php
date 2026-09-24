<?php
/**
 * Ładowanie styli, skryptów i pism.
 *
 * @package fwp-motyw
 */

defined( 'ABSPATH' ) || exit;

/**
 * Ładuje style wspólne dla całej witryny, w kolejności zależności.
 *
 * Plik tokens.css jest generowany z docs/figma/tokens.json (npm run tokens),
 * fonts.css zawiera deklaracje @font-face pism klienta i jest opcjonalny —
 * dopóki go nie ma, strona używa pism systemowych zamiast rzucać 404.
 *
 * @return void
 */
function fwp_enqueue_assets() {
	$sheets = array( 'tokens', 'fonts', 'base', 'layout' );

	$previous = null;
	foreach ( $sheets as $sheet ) {
		if ( ! file_exists( FWP_DIR . '/assets/css/' . $sheet . '.css' ) ) {
			continue;
		}

		wp_enqueue_style(
			'fwp-' . $sheet,
			FWP_URI . '/assets/css/' . $sheet . '.css',
			null === $previous ? array() : array( 'fwp-' . $previous ),
			FWP_VERSION
		);
		$previous = $sheet;
	}
}
add_action( 'wp_enqueue_scripts', 'fwp_enqueue_assets' );

/**
 * Pliki pism do preloadu, względem assets/fonts.
 *
 * Preloaduj wyłącznie pismo treści w podzbiorze z polskimi znakami
 * (zwykle latin-ext) — to ono niesie większość tekstu i decyduje o czasie
 * do pierwszego renderu. Pisma nagłówków dociągają się bez blokowania.
 * Każdy dodatkowy preload konkuruje o pasmo z obrazem LCP.
 *
 * @return string[] Nazwy plików, np. array( 'inter-latin-ext.woff2' ).
 */
function fwp_font_preloads() {
	// Uzupełnij po pobraniu pism (npm run fonts).
	return array();
}

/**
 * Wstawia preload pism z listy fwp_font_preloads().
 *
 * @return void
 */
function fwp_preload_fonts() {
	foreach ( fwp_font_preloads() as $file ) {
		if ( ! file_exists( FWP_DIR . '/assets/fonts/' . $file ) ) {
			continue;
		}

		printf(
			'<link rel="preload" href="%s" as="font" type="font/woff2" crossorigin>' . "\n",
			esc_url( FWP_URI . '/assets/fonts/' . $file )
		);
	}
}
add_action( 'wp_head', 'fwp_preload_fonts', 1 );

/**
 * Ładuje arkusz stylów pojedynczej sekcji. Wywoływane z szablonu sekcji,
 * pierwszą linią po defined( 'ABSPATH' ).
 *
 * Generyczne i idempotentne, żeby dodanie sekcji nie wymagało edycji tego
 * pliku — inaczej równoległe prace nad sekcjami biłyby się o assets.php.
 *
 * @param string $slug Slug sekcji, np. "home-hero".
 * @return void
 */
function fwp_enqueue_section_style( $slug ) {
	$handle = 'fwp-section-' . $slug;

	if ( wp_style_is( $handle, 'enqueued' ) ) {
		return;
	}

	wp_enqueue_style(
		$handle,
		FWP_URI . '/assets/css/sections/' . $slug . '.css',
		array( 'fwp-layout' ),
		FWP_VERSION
	);
}

/**
 * Ładuje arkusz stylów pojedynczego komponentu. Wywoływane z partiala komponentu.
 *
 * Generyczne z tego samego powodu co odpowiednik dla sekcji.
 *
 * @param string $name Nazwa pliku w assets/css/components bez rozszerzenia, np. "button".
 * @return void
 */
function fwp_enqueue_component_style( $name ) {
	$handle = 'fwp-component-' . $name;

	if ( wp_style_is( $handle, 'enqueued' ) ) {
		return;
	}

	wp_enqueue_style(
		$handle,
		FWP_URI . '/assets/css/components/' . $name . '.css',
		array( 'fwp-layout' ),
		FWP_VERSION
	);
}

/**
 * Ładuje skrypt zachowania sekcji. Wywoływane z szablonu sekcji.
 *
 * Skrypt dostaje defer i trafia do stopki, więc nie blokuje renderu.
 *
 * @param string $name Nazwa pliku w assets/js bez rozszerzenia, np. "carousel".
 * @return void
 */
function fwp_enqueue_section_script( $name ) {
	$handle = 'fwp-' . $name;

	if ( wp_script_is( $handle, 'enqueued' ) ) {
		return;
	}

	wp_enqueue_script(
		$handle,
		FWP_URI . '/assets/js/' . $name . '.js',
		array(),
		FWP_VERSION,
		array(
			'strategy'  => 'defer',
			'in_footer' => true,
		)
	);
}
