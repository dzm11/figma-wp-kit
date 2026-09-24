<?php
/**
 * Plugin Name: Blokada indeksowania podglądu
 * Description: Wyłącza indeksowanie na adresach podglądowych, nie ruszając produkcji.
 *
 * Działa wyłącznie dla hostów wymienionych w FWP_NOINDEX_HOSTS niżej.
 * Produkcyjna domena klienta ma się indeksować normalnie, więc lista jest
 * jawna i wąska — bezpieczniej niż warunek „wszystko poza produkcją”, który
 * przy pomyłce w konfiguracji wyciszyłby prawdziwą stronę.
 *
 * Cztery warstwy:
 * - `Disallow: /` w robots.txt, żeby roboty w ogóle nie chodziły po podglądzie,
 * - noindex w znaczniku meta (filtr wp_robots),
 * - nagłówek HTTP X-Robots-Tag dla odpowiedzi WordPressa,
 * - wyłączona mapa strony.
 *
 * Pliki statyczne (obrazy, PDF-y, arkusze) serwuje bezpośrednio serwer WWW,
 * z pominięciem PHP — dla nich nagłówek ustawia .htaccess, zob. docs/wdrozenie.md.
 *
 * Świadomy kompromis: robot, któremu zabroniono wejść, nie zobaczy noindex,
 * więc adres podlinkowany gdzieś z zewnątrz może trafić do wyników — bez
 * opisu. Jedyną pełną blokadą byłoby hasło HTTP, ale wtedy klient nie
 * obejrzy podglądu bez logowania.
 *
 * @package fwp-motyw
 */

defined( 'ABSPATH' ) || exit;

/*
 * Hosty traktowane jako podgląd — same nazwy hostów, bez schematu i portu,
 * małymi literami, np. 'klient.example-podglad.pl'.
 *
 * Uzupełnij w fazie wdrożenia. Pusta lista oznacza, że plugin nic nie robi.
 */
const FWP_NOINDEX_HOSTS = array();

/**
 * Czy bieżące żądanie trafia pod adres podglądowy.
 *
 * @return bool
 */
function fwp_is_preview_host() {
	static $cache = null;

	if ( null !== $cache ) {
		return $cache;
	}

	$host = '';

	// Za proxy (np. Cloudflare, tunel) prawdziwa domena przychodzi w X-Forwarded-Host.
	if ( ! empty( $_SERVER['HTTP_X_FORWARDED_HOST'] ) ) {
		$host = sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_FORWARDED_HOST'] ) );
	} elseif ( ! empty( $_SERVER['HTTP_HOST'] ) ) {
		$host = sanitize_text_field( wp_unslash( $_SERVER['HTTP_HOST'] ) );
	}

	// Przy kilku proxy nagłówek bywa listą; bierzemy pierwszy wpis i odcinamy port.
	$host  = strtolower( trim( explode( ',', $host )[0] ) );
	$host  = preg_replace( '/:\d+$/', '', $host );
	$cache = in_array( $host, FWP_NOINDEX_HOSTS, true );

	return $cache;
}

// Nagłówek HTTP dla odpowiedzi generowanych przez WordPressa.
add_filter(
	'wp_headers',
	static function ( $naglowki ) {
		if ( fwp_is_preview_host() ) {
			$naglowki['X-Robots-Tag'] = 'noindex, nofollow, noarchive, nosnippet';
		}

		return $naglowki;
	}
);

// Znacznik meta przez wp_robots, a nie własne echo — inaczej WordPress
// dokłada drugi znacznik z max-image-preview i w <head> są dwa sprzeczne.
add_filter(
	'wp_robots',
	static function ( $dyrektywy ) {
		if ( ! fwp_is_preview_host() ) {
			return $dyrektywy;
		}

		unset( $dyrektywy['max-image-preview'] );

		return array_merge(
			$dyrektywy,
			array(
				'noindex'   => true,
				'nofollow'  => true,
				'noarchive' => true,
				'nosnippet' => true,
			)
		);
	},
	99
);

// Mapa strony podawałaby robotom listę adresów, na które i tak nie mają wstępu.
add_filter(
	'wp_sitemaps_enabled',
	static function ( $wlaczone ) {
		return fwp_is_preview_host() ? false : $wlaczone;
	}
);

// Całkowity zakaz wchodzenia. Zastępuje treść WordPressa w całości, łącznie
// z wpisem Sitemap.
add_filter(
	'robots_txt',
	static function ( $tresc ) {
		if ( ! fwp_is_preview_host() ) {
			return $tresc;
		}

		return "# Adres podglądowy — roboty nie mają tu wstępu.\n"
			. "User-agent: *\n"
			. "Disallow: /\n";
	},
	20
);
