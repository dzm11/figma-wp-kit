<?php
/**
 * Szablon strony głównej.
 *
 * Sekcje i ich kolejność definiuje fwp_home_sections() w inc/sections.php.
 * Każda sekcja jest partialem template-parts/sections/home-{slug}.php
 * i sama ładuje swój arkusz — ten plik nie zmienia się przy dodawaniu sekcji.
 *
 * @package fwp-motyw
 */

defined( 'ABSPATH' ) || exit;

get_header();
?>
<main id="fwp-content">
	<?php fwp_render_home_sections(); ?>
</main>
<?php
get_footer();
