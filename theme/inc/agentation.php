<?php
/**
 * Pasek Agentation — zgłaszanie uwag do designu wprost ze strony.
 *
 * Narzędzie deweloperskie: pozwala kliknąć dowolny element, dopisać uwagę
 * i skopiować ustrukturyzowany opis (selektor, pozycja, kontekst) do wklejenia
 * agentowi. Bundle buduje `npm run agentation` z tools/agentation/.
 *
 * Ładuje się WYŁĄCZNIE w środowisku lokalnym. Poza nim nie jest w ogóle
 * rejestrowany, więc nie ma jak trafić na produkcję.
 *
 * @package fwp-motyw
 */

defined( 'ABSPATH' ) || exit;

/**
 * Rejestruje bundle paska Agentation w stopce dokumentu.
 *
 * @return void
 */
function fwp_enqueue_agentation() {
	if ( 'local' !== wp_get_environment_type() ) {
		return;
	}

	$relative = '/assets/js/agentation.bundle.js';
	$path     = FWP_DIR . $relative;

	// Bundle nie jest wymagany do działania motywu — bez niego po prostu
	// nie ma paska, zamiast błędu ładowania nieistniejącego pliku.
	if ( ! file_exists( $path ) ) {
		return;
	}

	wp_enqueue_script(
		'fwp-agentation',
		FWP_URI . $relative,
		array(),
		(string) filemtime( $path ),
		array(
			'strategy'  => 'defer',
			'in_footer' => true,
		)
	);
}
add_action( 'wp_enqueue_scripts', 'fwp_enqueue_agentation' );
