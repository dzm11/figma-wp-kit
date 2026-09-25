<?php
/**
 * Szablon podstrony.
 *
 * Sekcje i ich kolejność zwraca fwp_view_sections( widok ), czyli plik
 * inc/views/{widok}.php. Widok = szablon „Układ: …” wybrany w panelu albo
 * slug strony (fwp_page_view()). Strona bez listy sekcji pokazuje zwykłą
 * treść z edytora — np. nowe strony dodane przez redakcję.
 *
 * @package fwp-motyw
 */

defined( 'ABSPATH' ) || exit;

get_header();

$fwp_view     = fwp_page_view( get_queried_object_id() );
$fwp_sections = fwp_view_sections( $fwp_view );
?>
<main id="fwp-content" class="fwp-view fwp-view--<?php echo esc_attr( $fwp_view ); ?>">
	<?php
	if ( $fwp_sections ) {
		fwp_render_sections( $fwp_sections );
	} else {
		while ( have_posts() ) {
			the_post();
			?>
			<article <?php post_class( 'fwp-container fwp-page-content' ); ?>>
				<h1><?php the_title(); ?></h1>
				<?php the_content(); ?>
			</article>
			<?php
		}
	}
	?>
</main>
<?php
get_footer();
