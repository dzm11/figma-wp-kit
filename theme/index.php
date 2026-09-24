<?php
/**
 * Domyślny szablon zapasowy — standardowa pętla WordPressa.
 *
 * @package fwp-motyw
 */

defined( 'ABSPATH' ) || exit;

get_header();
?>
<main id="fwp-content" class="fwp-container">
	<?php if ( have_posts() ) : ?>
		<?php
		while ( have_posts() ) :
			the_post();
			?>
			<article <?php post_class(); ?>>
				<h1><?php the_title(); ?></h1>
				<?php the_content(); ?>
			</article>
			<?php
		endwhile;
		?>
	<?php else : ?>
		<p><?php esc_html_e( 'Nie znaleziono treści.', 'fwp-motyw' ); ?></p>
	<?php endif; ?>
</main>
<?php
get_footer();
