<?php
/**
 * Stopka witryny i zamknięcie dokumentu.
 *
 * Właściwą stopkę budujesz w template-parts/footer/site-footer.php — ten plik
 * tylko ją dołącza, dokładnie jak header.php robi to na wejściu. Dopóki
 * partiala nie ma, renderuje się minimalna stopka zastępcza.
 *
 * @package fwp-motyw
 */

defined( 'ABSPATH' ) || exit;

if ( false === get_template_part( 'template-parts/footer/site-footer' ) ) :
	?>
	<footer class="fwp-site-fallback">
		<div class="fwp-container">
			<p>&copy; <?php echo esc_html( gmdate( 'Y' ) ); ?> <?php bloginfo( 'name' ); ?></p>
		</div>
	</footer>
	<?php
endif;

wp_footer();
?>
</body>
</html>
