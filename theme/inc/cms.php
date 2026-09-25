<?php
/**
 * Fundament CMS (faza 6): typy treści kolekcji, reguła lokalizacji pól
 * „widok” i helpery czytające pola z fallbackiem na treść z makiety.
 *
 * Model treści, od którego zaczynamy:
 * - kolekcje (elementy powtarzane w wielu sekcjach, np. opinie, pytania)
 *   to typy treści z fwp_register_collections();
 * - treść pojedynczej sekcji to pola strony widoku (reguła „Widok motywu”),
 *   strona główna — pola strony ustawionej jako strona główna;
 * - dane globalne — strona „Ustawienia witryny” (inc/options.php).
 *
 * @package fwp-motyw
 */

defined( 'ABSPATH' ) || exit;

/**
 * Rejestruje typy treści (i ich taksonomie) kolekcji.
 *
 * Kolekcje nie mają własnych adresów (publicly_queryable false): pokazują je
 * sekcje stron. Element, który ma własną podstronę z układem sekcji, zostaje
 * zwykłą stroną WordPressa, a nie typem treści.
 *
 * Wzór wpisu w $types (klucz = slug typu, maks. 20 znaków, bez myślników):
 *
 *     'opinia' => array(
 *         'plural'     => __( 'Opinie', 'fwp-motyw' ),
 *         'singular'   => __( 'Opinia', 'fwp-motyw' ),
 *         'icon'       => 'dashicons-star-filled',
 *         'supports'   => array( 'title', 'page-attributes' ),
 *         'taxonomies' => array(
 *             'kategoria_opinii' => array( __( 'Kategorie opinii', 'fwp-motyw' ), __( 'Kategoria opinii', 'fwp-motyw' ) ),
 *         ),
 *     ),
 *
 * 'page-attributes' daje pole Kolejność, po którym sortuje fwp_collection().
 * Funkcje dostępu do kolekcji: inc/collections/{typ}.php (README obok).
 *
 * @return void
 */
function fwp_register_collections() {
	$types = array(
		// Uzupełnij typami kolekcji z modelu treści (wzór wyżej).
	);

	$types = (array) apply_filters( 'fwp_collections', $types );

	foreach ( $types as $type => $def ) {
		$def = wp_parse_args(
			(array) $def,
			array(
				'plural'     => $type,
				'singular'   => $type,
				'icon'       => 'dashicons-admin-post',
				'supports'   => array( 'title', 'page-attributes' ),
				'taxonomies' => array(),
			)
		);

		register_post_type(
			$type,
			array(
				'labels'              => array(
					'name'          => $def['plural'],
					'singular_name' => $def['singular'],
					'add_new_item'  => $def['singular'] . ': ' . __( 'dodaj', 'fwp-motyw' ),
					'edit_item'     => $def['singular'] . ': ' . __( 'edycja', 'fwp-motyw' ),
				),
				'public'              => false,
				'publicly_queryable'  => false,
				'exclude_from_search' => true,
				'show_ui'             => true,
				'show_in_menu'        => true,
				'show_in_rest'        => false,
				'menu_icon'           => $def['icon'],
				'supports'            => $def['supports'],
				'hierarchical'        => false,
				'has_archive'         => false,
				'rewrite'             => false,
			)
		);

		foreach ( (array) $def['taxonomies'] as $taxonomy => $names ) {
			register_taxonomy(
				$taxonomy,
				$type,
				array(
					'labels'            => array(
						'name'          => $names[0],
						'singular_name' => $names[1] ?? $names[0],
					),
					'public'            => false,
					'show_ui'           => true,
					'show_admin_column' => true,
					'show_in_rest'      => false,
					'hierarchical'      => true,
					'rewrite'           => false,
				)
			);
		}
	}
}
add_action( 'init', 'fwp_register_collections' );

/*
 * Reguła lokalizacji grup pól „Widok motywu == {widok}”.
 *
 * ID stron różnią się między środowiskami, a slug widoku jest stały
 * (to ta sama nazwa co plik inc/views/{widok}.php). Grupa pól podstrony:
 * 'location' => array( array( array( 'param' => 'fwp_view', 'operator' => '==', 'value' => 'cennik' ) ) ).
 */

/**
 * Dodaje typ reguły „Widok motywu” do lokalizacji grup pól.
 *
 * @param array $choices Typy reguł pogrupowane etykietami.
 * @return array
 */
function fwp_view_rule_type( $choices ) {
	$choices[ __( 'Motyw', 'fwp-motyw' ) ]['fwp_view'] = __( 'Widok motywu (układ strony)', 'fwp-motyw' );

	return $choices;
}
add_filter( 'acf/location/rule_types', 'fwp_view_rule_type' );

/**
 * Wartości reguły „Widok motywu”: pliki inc/views/*.php.
 *
 * @param array $choices Wartości reguły.
 * @return array
 */
function fwp_view_rule_values( $choices ) {
	foreach ( glob( FWP_DIR . '/inc/views/*.php' ) as $file ) {
		$slug             = basename( $file, '.php' );
		$choices[ $slug ] = $slug;
	}

	return $choices;
}
add_filter( 'acf/location/rule_values/fwp_view', 'fwp_view_rule_values' );

/**
 * Dopasowanie reguły „Widok motywu” do edytowanej strony (fwp_page_view()).
 *
 * @param bool  $is_match Wynik dotychczasowy.
 * @param array $rule     Reguła: param, operator, value.
 * @param array $screen   Kontekst ekranu edycji.
 * @return bool
 */
function fwp_view_rule_match( $is_match, $rule, $screen ) {
	if ( empty( $screen['post_id'] ) || 'page' !== get_post_type( $screen['post_id'] ) ) {
		return false;
	}

	$is = fwp_page_view( $screen['post_id'] ) === $rule['value'];

	return '==' === $rule['operator'] ? $is : ! $is;
}
add_filter( 'acf/location/rule_match/fwp_view', 'fwp_view_rule_match', 10, 3 );

/**
 * Czy pole zostało kiedykolwiek zapisane (strona albo ustawienia).
 *
 * Odróżnia „nigdy nie wypełnione” (pokazujemy treść z makiety) od
 * „świadomie wyczyszczone” (sekcja albo lista znika).
 *
 * @param string          $name    Nazwa pola.
 * @param int|string|bool $post_id ID strony, 'option' albo false (bieżąca strona).
 * @return bool
 */
function fwp_field_saved( $name, $post_id = false ) {
	if ( 'option' === $post_id || 'options' === $post_id ) {
		return null !== get_option( 'options_' . $name, null );
	}

	$id = $post_id ? (int) $post_id : (int) get_queried_object_id();

	return $id && metadata_exists( 'post', $id, $name );
}

/**
 * Wiersze repeatera z fallbackiem na listę z makiety.
 *
 * Nigdy nie zapisany repeater zwraca $fallback (strona wygląda jak makieta),
 * zapisany pusty — pustą tablicę (sekcja chowa listę). Klucze wierszy
 * repeatera = klucze tablicy z makiety (nazwy podpól), więc partial nie
 * zmienia pętli po podpięciu CMS.
 *
 * @param string          $name     Nazwa pola repeatera.
 * @param array           $fallback Wiersze z makiety.
 * @param int|string|bool $post_id  ID strony, 'option' albo false.
 * @return array
 */
function fwp_rows( $name, $fallback = array(), $post_id = false ) {
	if ( ! function_exists( 'get_field' ) ) {
		return $fallback;
	}

	if ( ! fwp_field_saved( $name, $post_id ) ) {
		fwp_remember_rows( $name, $fallback, $post_id );
		return $fallback;
	}

	$rows = get_field( $name, $post_id );

	return is_array( $rows ) ? $rows : array();
}

/**
 * Kontekst zapisu pola: 'option' albo ID strony (jak w fwp_field_saved()).
 *
 * @param int|string|bool $post_id ID strony, 'option'/'options' albo false.
 * @return string
 */
function fwp_rows_context( $post_id ) {
	if ( 'option' === $post_id || 'options' === $post_id ) {
		return 'option';
	}

	return (string) ( $post_id ? (int) $post_id : (int) get_queried_object_id() );
}

/*
 * Listy z makiety w panelu.
 *
 * Repeater, którego nikt nie zapisał, byłby w panelu pusty, a pierwsze
 * „Aktualizuj” zapisałoby pustą listę i treść z makiety zniknęłaby ze strony.
 * Dlatego fwp_rows() przy wyświetlaniu strony zapamiętuje listę z makiety
 * (opcja fwp_rows_fallback_{kontekst}, bez autoload, zapis tylko przy zmianie),
 * a panel wczytuje ją do pustego repeatera. Redaktor widzi i poprawia
 * prawdziwą treść. Lista trafia do panelu po pierwszym wyświetleniu strony.
 */

/**
 * Zapamiętuje listę z makiety dla panelu.
 *
 * @param string          $name     Nazwa pola repeatera.
 * @param array           $fallback Wiersze z makiety.
 * @param int|string|bool $post_id  ID strony, 'option' albo false.
 * @return void
 */
function fwp_remember_rows( $name, $fallback, $post_id ) {
	if ( is_admin() || empty( $fallback ) || ! is_array( $fallback ) ) {
		return;
	}

	$context = fwp_rows_context( $post_id );
	if ( '0' === $context ) {
		return;
	}

	$option = 'fwp_rows_fallback_' . $context;
	$store  = get_option( $option, array() );
	$hash   = md5( (string) wp_json_encode( $fallback ) );

	if ( isset( $store[ $name ]['hash'] ) && $store[ $name ]['hash'] === $hash ) {
		return;
	}

	$store[ $name ] = array(
		'hash' => $hash,
		'rows' => $fallback,
	);
	update_option( $option, $store, false );
}

/**
 * Zamienia wiersze z makiety (klucze = nazwy podpól) na format repeatera SCF
 * (klucze = klucze podpól).
 *
 * Obrazy z makiety to pliki motywu, nie załączniki, więc pole obrazu zostaje
 * puste (partial pokaże plik z motywu przez fwp_image()).
 *
 * @param array $rows       Wiersze z makiety.
 * @param array $sub_fields Podpola repeatera.
 * @return array
 */
function fwp_rows_to_acf( $rows, $sub_fields ) {
	$out = array();

	foreach ( $rows as $row ) {
		if ( ! is_array( $row ) ) {
			continue;
		}

		$item = array();
		foreach ( $sub_fields as $sub ) {
			$value = $row[ $sub['name'] ] ?? '';

			if ( 'repeater' === $sub['type'] ) {
				$value = is_array( $value ) ? fwp_rows_to_acf( $value, $sub['sub_fields'] ?? array() ) : array();
			} elseif ( in_array( $sub['type'], array( 'image', 'file', 'gallery' ), true ) ) {
				$value = is_numeric( $value ) ? (int) $value : '';
			} elseif ( 'true_false' === $sub['type'] ) {
				$value = $value ? 1 : 0;
			} elseif ( is_array( $value ) ) {
				$value = in_array( $sub['type'], array( 'checkbox', 'select' ), true ) ? $value : '';
			}

			$item[ $sub['key'] ] = $value;
		}
		$out[] = $item;
	}

	return $out;
}

/**
 * Wczytuje zapamiętaną listę z makiety do pustego, nigdy nie zapisanego
 * repeatera w panelu.
 *
 * @param mixed      $value   Wartość pola.
 * @param int|string $post_id ID wpisu albo 'option'/'options'.
 * @param array      $field   Definicja pola.
 * @return mixed
 */
function fwp_rows_load_fallback( $value, $post_id, $field ) {
	if ( ! is_admin() || ! empty( $value ) || empty( $field['sub_fields'] ) ) {
		return $value;
	}

	// Podpola (repeater w repeaterze) mają nazwy z indeksem wiersza — pomijamy.
	if ( ! empty( $field['parent'] ) && 0 === strpos( (string) $field['parent'], 'field_' ) ) {
		return $value;
	}

	$context = fwp_rows_context( is_numeric( $post_id ) ? (int) $post_id : $post_id );
	if ( fwp_field_saved( $field['name'], 'option' === $context ? 'option' : (int) $context ) ) {
		return $value;
	}

	$store = get_option( 'fwp_rows_fallback_' . $context, array() );
	if ( empty( $store[ $field['name'] ]['rows'] ) ) {
		return $value;
	}

	return fwp_rows_to_acf( $store[ $field['name'] ]['rows'], $field['sub_fields'] );
}
add_filter( 'acf/load_value/type=repeater', 'fwp_rows_load_fallback', 30, 3 );

/*
 * Bez sizes="auto" w obrazach z biblioteki: fwp_image() zawsze podaje własne
 * sizes z makiety, a „auto” sprawiało, że przeglądarka pobierała drugi raz
 * inny rozmiar (i zrzuty do porównań były niestabilne).
 */
add_filter( 'wp_img_tag_add_auto_sizes', '__return_false' );

/**
 * Obraz z pola CMS (ID załącznika) albo plik motywu z makiety.
 *
 * @param mixed  $image    ID załącznika, tablica obrazu SCF albo pusta wartość.
 * @param string $fallback Ścieżka względem theme/assets/img/ (jak w fwp_img()).
 * @param string $alt      Tekst alternatywny (dla załącznika: gdy ten nie ma własnego).
 * @param array  $attrs    Atrybuty jak w fwp_img(): class, width, height, loading, fetchpriority, sizes.
 * @return string Bezpieczny HTML.
 */
function fwp_image( $image, $fallback, $alt = '', $attrs = array() ) {
	$id = is_array( $image ) ? (int) ( $image['ID'] ?? 0 ) : (int) $image;

	if ( $id && wp_attachment_is_image( $id ) ) {
		$own_alt = (string) get_post_meta( $id, '_wp_attachment_image_alt', true );
		$html    = array(
			'alt'      => '' !== $own_alt ? $own_alt : $alt,
			'loading'  => $attrs['loading'] ?? 'lazy',
			'decoding' => 'async',
		);

		foreach ( array( 'class', 'fetchpriority', 'sizes' ) as $key ) {
			if ( ! empty( $attrs[ $key ] ) ) {
				$html[ $key ] = $attrs[ $key ];
			}
		}

		return (string) wp_get_attachment_image( $id, 'full', false, $html );
	}

	return '' !== (string) $fallback ? fwp_img( $fallback, $alt, $attrs ) : '';
}

/**
 * Wpisy kolekcji w kolejności z panelu (Atrybuty → Kolejność, potem data).
 *
 * @param string $type Typ treści z fwp_register_collections().
 * @param array  $args Dodatkowe argumenty WP_Query (tax_query, meta_query, posts_per_page…).
 * @return WP_Post[]
 */
function fwp_collection( $type, $args = array() ) {
	$query = new WP_Query(
		array_merge(
			array(
				'post_type'              => $type,
				'post_status'            => 'publish',
				'posts_per_page'         => -1,
				'orderby'                => array(
					'menu_order' => 'ASC',
					'date'       => 'ASC',
				),
				'no_found_rows'          => true,
				'update_post_term_cache' => true,
			),
			$args
		)
	);

	return $query->posts;
}

/*
 * Funkcje dostępu do kolekcji: inc/collections/{typ}.php (inc/collections/README.md).
 * Ładowane zawsze, także bez wtyczki SCF, bo wołają je partiale.
 */
foreach ( glob( FWP_DIR . '/inc/collections/*.php' ) as $fwp_collection_file ) {
	require_once $fwp_collection_file;
}
