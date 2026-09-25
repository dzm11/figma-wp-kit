<?php
/**
 * Funkcje pomocnicze szablonów.
 *
 * @package fwp-motyw
 */

defined( 'ABSPATH' ) || exit;

/**
 * Zwraca znacznik ikony odwołujący się do sprite'u assets/img/icons.svg.
 *
 * Ikona dziedziczy kolor tekstu przez currentColor, więc kolorujemy ją zwykłym
 * property color w CSS, a nie fillem na samym svg. Ikona jest dekoracyjna
 * (aria-hidden) — jeśli niesie znaczenie, opis daj elementowi nadrzędnemu.
 *
 * @param string $name  Nazwa symbolu bez przedrostka "icon-", np. "arrow-right".
 * @param array  $attrs Dodatkowe atrybuty, np. array( 'class' => 'fwp-card__icon' ).
 * @return string Bezpieczny HTML.
 */
function fwp_icon( $name, $attrs = array() ) {
	$classes = 'fwp-icon';
	if ( ! empty( $attrs['class'] ) ) {
		$classes .= ' ' . $attrs['class'];
	}

	return sprintf(
		'<svg class="%1$s" aria-hidden="true" focusable="false"><use href="%2$s#icon-%3$s"></use></svg>',
		esc_attr( $classes ),
		esc_url( FWP_URI . '/assets/img/icons.svg' ),
		esc_attr( $name )
	);
}

/**
 * Zwraca wartość pola SCF z wartością domyślną.
 *
 * Osłania szablony przed sytuacją, w której wtyczka jest wyłączona — bez tego
 * każdy szablon wywala białą stronę zamiast po prostu nie pokazać sekcji.
 * Wartość domyślna to też miejsce na treść z makiety: sekcja renderuje się
 * od razu, zanim ktokolwiek wypełni pola w panelu.
 *
 * @param string $name     Nazwa pola.
 * @param mixed  $fallback Wartość zwracana, gdy pola nie ma albo jest puste.
 * @param mixed  $post_id  Identyfikator wpisu lub "option".
 * @return mixed
 */
function fwp_field( $name, $fallback = '', $post_id = false ) {
	if ( ! function_exists( 'get_field' ) ) {
		return $fallback;
	}

	$value = get_field( $name, $post_id );

	return ( null === $value || '' === $value || false === $value ) ? $fallback : $value;
}

/**
 * Sprawdza, czy sekcja została wyłączona na potrzeby testu stanu pustego
 * (parametr ?fwp_empty=home-hero).
 *
 * Działa wyłącznie w środowisku lokalnym. Bez tego każdy test stanu pustego
 * musiałby czyścić pola w bazie i przywracać je po sobie, co rozsadza
 * równoległe uruchamianie testów.
 *
 * @param string $slug Slug sekcji, np. "home-hero".
 * @return bool
 */
function fwp_section_disabled( $slug ) {
	if ( 'local' !== wp_get_environment_type() ) {
		return false;
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- parametr diagnostyczny, tylko lokalnie.
	return isset( $_GET['fwp_empty'] ) && sanitize_key( wp_unslash( $_GET['fwp_empty'] ) ) === $slug;
}

/**
 * Renderuje obraz z theme/assets/img jako picture z wariantem WebP.
 *
 * Oczekuje obok oryginału pliku .webp o tej samej nazwie (tworzy go
 * npm run images). Jeśli istnieje wariant @2x, dokłada gęstość 2x.
 *
 * Podawaj zawsze width i height — bez nich przeglądarka nie zna proporcji
 * obrazu przed pobraniem i układ skacze (CLS).
 *
 * @param string $path  Ścieżka względem assets/img, np. "hero/hero.jpg".
 * @param string $alt   Tekst alternatywny. Pusty dla grafiki dekoracyjnej.
 * @param array  $attrs Klucze: class, width, height, loading, fetchpriority, sizes.
 * @return string Bezpieczny HTML.
 */
function fwp_img( $path, $alt = '', $attrs = array() ) {
	$defaults = array(
		'class'         => '',
		'width'         => '',
		'height'        => '',
		'loading'       => 'lazy',
		'fetchpriority' => '',
		'sizes'         => '',
	);
	$attrs    = array_merge( $defaults, $attrs );

	if ( '' === (string) $attrs['width'] || '' === (string) $attrs['height'] ) {
		_doing_it_wrong( __FUNCTION__, esc_html__( 'Obraz wymaga jawnych width i height.', 'fwp-motyw' ), '0.1.0' );
	}

	$extension = pathinfo( $path, PATHINFO_EXTENSION );
	$stem      = substr( $path, 0, -( strlen( $extension ) + 1 ) );
	$retina    = $stem . '@2x.' . $extension;

	$url = static function ( $relative ) {
		return FWP_URI . '/assets/img/' . ltrim( $relative, '/' );
	};

	$has_webp   = file_exists( FWP_DIR . '/assets/img/' . $stem . '.webp' );
	$has_retina = file_exists( FWP_DIR . '/assets/img/' . $retina );

	$webp_srcset = $url( $stem . '.webp' );
	$src_srcset  = $url( $path );
	if ( $has_retina ) {
		$webp_srcset .= ' 1x, ' . $url( $stem . '@2x.webp' ) . ' 2x';
		$src_srcset  .= ' 1x, ' . $url( $retina ) . ' 2x';
	}

	$img_attrs = sprintf(
		'src="%s" srcset="%s" alt="%s" loading="%s" decoding="async"',
		esc_url( $url( $path ) ),
		esc_attr( $src_srcset ),
		esc_attr( $alt ),
		esc_attr( $attrs['loading'] )
	);

	foreach ( array( 'class', 'width', 'height', 'fetchpriority', 'sizes' ) as $key ) {
		if ( '' !== (string) $attrs[ $key ] ) {
			$img_attrs .= sprintf( ' %s="%s"', $key, esc_attr( $attrs[ $key ] ) );
		}
	}

	$source = $has_webp
		? sprintf( '<source type="image/webp" srcset="%s">', esc_attr( $webp_srcset ) )
		: '';

	// Każdy człon jest escapowany wyżej, więc wynik można bezpiecznie wypisać.
	return sprintf( '<picture>%s<img %s></picture>', $source, $img_attrs );
}

/**
 * Adres opublikowanej strony WordPressa po ścieżce slugów (np. 'uslugi/cennik').
 *
 * Pusty, gdy strony nie ma albo nie jest opublikowana — link może wtedy
 * zniknąć albo dostać stan nieaktywny, zamiast prowadzić na 404. Przydatne
 * w zapasowym menu nagłówka i stopki, dopóki menu WP nie jest przypisane,
 * i w linkach między podstronami zapisanych w treści z makiety.
 * Wynik nie jest escapowany — przepuść go przez esc_url().
 *
 * @param string $path Ścieżka strony (slugi rozdzielone ukośnikiem).
 * @return string Adres albo pusty ciąg.
 */
function fwp_page_url( $path ) {
	$page = get_page_by_path( trim( (string) $path, '/' ) );

	return ( $page && 'publish' === $page->post_status ) ? (string) get_permalink( $page ) : '';
}
