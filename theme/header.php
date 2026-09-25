<?php
/**
 * Nagłówek dokumentu: doctype, head, otwarcie body i nagłówek witryny.
 *
 * Właściwy nagłówek witryny budujesz w template-parts/header/site-header.php
 * (ewentualny pasek ogłoszeń w template-parts/header/announcement-bar.php).
 * Dopóki partiala nie ma, renderuje się minimalny nagłówek zastępczy,
 * żeby pusty motyw dało się otworzyć bez błędów.
 *
 * Skrypt w <head> dodaje klasę fwp-js na <html> przed pierwszym malowaniem:
 * CSS rozróżnia stan z JS i bez niego (np. :root:not(.fwp-js) w layout.css)
 * bez mignięcia układu. Stan bez JS to ten, w którym skrypty sekcji nic nie
 * zmieniły — np. przyklejony nagłówek się nie zwija.
 *
 * @package fwp-motyw
 */

defined( 'ABSPATH' ) || exit;
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<script>document.documentElement.classList.add( 'fwp-js' );</script>
	<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<a class="fwp-skip-link" href="#fwp-content"><?php esc_html_e( 'Przejdź do treści', 'fwp-motyw' ); ?></a>
<?php
/*
 * Skip-link musi być pierwszym elementem w <body>, przed wp_body_open() —
 * wtyczki (analityka, banery zgód) doczepiają tam często własny fokusowalny
 * element, co przesunęłoby skip-link w kolejności Tab.
 */
wp_body_open();

// get_template_part() na nieistniejący plik jest bezpieczny — nic nie renderuje.
get_template_part( 'template-parts/header/announcement-bar' );

if ( false === get_template_part( 'template-parts/header/site-header' ) ) :
	?>
	<header class="fwp-site-fallback">
		<div class="fwp-container">
			<a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php bloginfo( 'name' ); ?></a>
		</div>
	</header>
	<?php
endif;
