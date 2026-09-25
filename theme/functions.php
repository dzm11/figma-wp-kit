<?php
/**
 * Bootstrap motywu FWP Motyw.
 *
 * Wyłącznie stałe i dołączanie modułów z inc/ — żadnej logiki. Dzięki temu
 * równoległe prace nad sekcjami nie spotykają się w tym pliku.
 *
 * @package fwp-motyw
 */

defined( 'ABSPATH' ) || exit;

define( 'FWP_VERSION', wp_get_theme()->get( 'Version' ) );
define( 'FWP_DIR', untrailingslashit( get_template_directory() ) );
define( 'FWP_URI', untrailingslashit( get_template_directory_uri() ) );

$fwp_modules = array(
	'setup',
	'assets',
	'helpers',
	'sections',
	'options',
	'cms',
	'agentation',
);

foreach ( $fwp_modules as $fwp_module ) {
	require_once FWP_DIR . '/inc/' . $fwp_module . '.php';
}
