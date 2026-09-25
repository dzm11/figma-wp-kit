<?php
/**
 * Szablon strony 404.
 *
 * Sekcje z inc/views/404.php, jeśli widok „404” ma listę sekcji. Bez niej
 * (np. zanim powstanie makieta strony błędu) prosty komunikat z linkiem
 * na stronę główną.
 *
 * @package fwp-motyw
 */

defined( 'ABSPATH' ) || exit;

get_header();

$fwp_sections = fwp_view_sections( '404' );
?>
<main id="fwp-content" class="fwp-view fwp-view--404">
	<?php if ( $fwp_sections ) : ?>
		<?php fwp_render_sections( $fwp_sections ); ?>
	<?php else : ?>
		<article class="fwp-container fwp-page-content">
			<h1><?php esc_html_e( 'Nie znaleziono strony', 'fwp-motyw' ); ?></h1>
			<p><?php esc_html_e( 'Strona, której szukasz, nie istnieje albo została przeniesiona.', 'fwp-motyw' ); ?></p>
			<p><a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'Wróć na stronę główną', 'fwp-motyw' ); ?></a></p>
		</article>
	<?php endif; ?>
</main>
<?php
get_footer();
