<?php
/**
 * Plugin Name: Adres z tunelu
 * Description: Pozwala udostępnić lokalny WordPress pod publicznym adresem
 *              bez przepisywania adresów w bazie.
 *
 * WordPress trzyma `home` i `siteurl` w bazie jako http://localhost:8888.
 * Po wejściu spoza tej maszyny przeglądarka odbiorcy próbuje więc pobrać
 * arkusze, skrypty i obrazy ze swojego localhosta, czyli znikąd — strona
 * przychodzi goła. Ten plugin podmienia oba adresy na host, z którego
 * faktycznie przyszło żądanie.
 *
 * Działa WYŁĄCZNIE dla wypisanych domen tunelowych i tylko w środowisku
 * lokalnym. Nagłówek Host jest danymi od klienta — bez tego ograniczenia
 * dowolny odwiedzający mógłby przestawić adres witryny, co jest klasyczną
 * drogą do zatrutych linków resetu hasła i zatrutej pamięci podręcznej.
 *
 * @package fwp-motyw
 */

defined( 'ABSPATH' ) || exit;

/**
 * Zwraca adres bazowy z żądania, jeśli przyszło spod zaufanej domeny.
 *
 * @return string|false Adres bez ukośnika na końcu albo false.
 */
function fwp_tunnel_base_url() {
	static $cache = null;

	if ( null !== $cache ) {
		return $cache;
	}

	$cache = false;

	if ( 'local' !== wp_get_environment_type() ) {
		return $cache;
	}

	/*
	 * cloudflared przepisuje nagłówek Host na adres źródła, czyli localhost:8888 —
	 * prawdziwa domena tunelu przychodzi w X-Forwarded-Host. Sprawdzamy więc
	 * najpierw ją, a Host dopiero jako zapas.
	 */
	$surowy = '';

	if ( ! empty( $_SERVER['HTTP_X_FORWARDED_HOST'] ) ) {
		$surowy = sanitize_text_field( wp_unslash( $_SERVER['HTTP_X_FORWARDED_HOST'] ) );
	} elseif ( ! empty( $_SERVER['HTTP_HOST'] ) ) {
		$surowy = sanitize_text_field( wp_unslash( $_SERVER['HTTP_HOST'] ) );
	}

	if ( '' === $surowy ) {
		return $cache;
	}

	// Przy kilku proxy nagłówek bywa listą; bierzemy pierwszy wpis.
	$host = strtolower( trim( explode( ',', $surowy )[0] ) );

	// Ufamy wyłącznie wypisanym domenom, nigdy dowolnemu nagłówkowi Host.
	$zaufane = array( '.trycloudflare.com', '.ngrok-free.app', '.ngrok.io', '.loca.lt' );

	foreach ( $zaufane as $domena ) {
		if ( substr( $host, -strlen( $domena ) ) === $domena ) {
			$cache = 'https://' . $host;
			break;
		}
	}

	return $cache;
}

foreach ( array( 'option_home', 'option_siteurl' ) as $fwp_filtr ) {
	add_filter(
		$fwp_filtr,
		static function ( $wartosc ) {
			$baza = fwp_tunnel_base_url();

			return $baza ? $baza : $wartosc;
		}
	);
}

/**
 * Podmienia lokalny adres bazowy na adres tunelu w dowolnym adresie URL.
 *
 * Potrzebne, bo `wp-env` definiuje WP_CONTENT_URL, WP_HOME i WP_SITEURL jako
 * **stałe** w wp-config. Filtry `option_home` i `option_siteurl` nie mają do nich
 * dostępu, więc `home_url()` wskazywał już tunel, a `content_url()` dalej
 * localhost — i tym drugim budowane są adresy arkuszy, skryptów oraz obrazów
 * motywu. Strona przychodziła przez to bez stylów.
 *
 * @param string $url Adres do przepisania.
 * @return string
 */
function fwp_tunnel_swap_base( $url ) {
	$baza = fwp_tunnel_base_url();

	if ( ! $baza || ! is_string( $url ) || '' === $url ) {
		return $url;
	}

	$lokalne = array();

	foreach ( array( 'WP_HOME', 'WP_SITEURL' ) as $stala ) {
		if ( defined( $stala ) ) {
			$host = wp_parse_url( constant( $stala ), PHP_URL_HOST );
			$port = wp_parse_url( constant( $stala ), PHP_URL_PORT );

			if ( $host ) {
				$autorytet = $host . ( $port ? ':' . $port : '' );
				// Adres bywa zbudowany z dowolnym schematem, bo is_ssl() jest tu prawdziwe.
				$lokalne[] = 'http://' . $autorytet;
				$lokalne[] = 'https://' . $autorytet;
			}
		}
	}

	return $lokalne ? str_replace( array_unique( $lokalne ), $baza, $url ) : $url;
}

foreach ( array( 'content_url', 'plugins_url', 'theme_root_uri', 'stylesheet_directory_uri', 'template_directory_uri', 'includes_url', 'admin_url' ) as $fwp_filtr_url ) {
	add_filter( $fwp_filtr_url, 'fwp_tunnel_swap_base' );
}

// Biblioteka mediów trzyma własny adres bazowy, poza powyższymi filtrami.
add_filter(
	'upload_dir',
	static function ( $katalog ) {
		foreach ( array( 'url', 'baseurl' ) as $klucz ) {
			if ( ! empty( $katalog[ $klucz ] ) ) {
				$katalog[ $klucz ] = fwp_tunnel_swap_base( $katalog[ $klucz ] );
			}
		}

		return $katalog;
	}
);
