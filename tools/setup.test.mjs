import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
	czyBinarny,
	parsujArgumenty,
	parsujUrlFigmy,
	planZmianNazw,
	podmienTresc,
	prefiksZeSluga,
	scalProjekt,
	slugZNazwy,
	ustawNazwePakietu,
	ustawNazweMotywu,
	walidujKlienta,
	walidujPrefiks,
	walidujSlug,
	znajdzPozostalosci,
} from './setup.mjs';

const CFG = { klient: 'Acme Budownictwo', slug: 'acme', prefiks: 'ac' };

// ─── parsujUrlFigmy ─────────────────────────────────────────────────────────

test( 'adres ramki: klucz pliku i node-id w formie z API', () => {
	assert.deepEqual(
		parsujUrlFigmy( 'https://www.figma.com/design/AbCdEfGh1234567890XyZq/Strona?node-id=470-29428&t=abc' ),
		{ fileKey: 'AbCdEfGh1234567890XyZq', nodeId: '470:29428' }
	);
} );

test( 'adres pliku bez node-id daje nodeId null', () => {
	assert.deepEqual( parsujUrlFigmy( 'https://www.figma.com/design/ABC123xyz0/Nazwa-pliku' ), {
		fileKey: 'ABC123xyz0',
		nodeId: null,
	} );
} );

test( 'obsługuje /file/, /proto/, zakodowany dwukropek i adres bez www', () => {
	assert.equal( parsujUrlFigmy( 'https://figma.com/file/KEY1234567/X?node-id=1%3A2' ).nodeId, '1:2' );
	assert.equal( parsujUrlFigmy( 'https://www.figma.com/proto/KEY1234567/X?node-id=12:34' ).nodeId, '12:34' );
	assert.equal( parsujUrlFigmy( 'https://www.figma.com/design/ABC123/Test?node-id=1-2' ).fileKey, 'ABC123' );
} );

test( 'przyjmuje sam klucz pliku', () => {
	assert.deepEqual( parsujUrlFigmy( 'AbCdEfGh1234567890XyZq' ), {
		fileKey: 'AbCdEfGh1234567890XyZq',
		nodeId: null,
	} );
} );

test( 'odrzuca adresy spoza Figmy i śmieci', () => {
	assert.throws( () => parsujUrlFigmy( 'https://example.com/design/ABC/x' ), /figma\.com/ );
	assert.throws( () => parsujUrlFigmy( 'https://notfigma.com/design/ABC/x' ), /figma\.com/ );
	assert.throws( () => parsujUrlFigmy( 'https://www.figma.com/community/file/123' ), /klucza/ );
	assert.throws( () => parsujUrlFigmy( 'nie adres' ), /adres Figmy/ );
	assert.throws( () => parsujUrlFigmy( 'https://www.figma.com/design/ABC123/x?node-id=abc' ), /node-id/ );
} );

// ─── walidacja ──────────────────────────────────────────────────────────────

test( 'prefiks: poprawne i błędne', () => {
	for ( const ok of [ 'ac', 'tt', 'abc123', 'x9' ] ) {
		assert.equal( walidujPrefiks( ok ), null, ok );
	}
	for ( const zly of [ '', 'a', 'Ab', '1ab', 'abcdefg', 'a-b', 'a_b', 'fwp', undefined ] ) {
		assert.notEqual( walidujPrefiks( zly ), null, String( zly ) );
	}
	assert.match( walidujPrefiks( 'fwp' ), /placeholder/ );
} );

test( 'slug: poprawne i błędne', () => {
	for ( const ok of [ 'acme', 'testowy', 'acme-budownictwo', 'a1b' ] ) {
		assert.equal( walidujSlug( ok ), null, ok );
	}
	for ( const zly of [ '', 'ab', '1acme', 'Acme', 'acme_x', 'a'.repeat( 42 ), 'fwp-motyw' ] ) {
		assert.notEqual( walidujSlug( zly ), null, zly );
	}
	assert.match( walidujSlug( 'fwp-motyw' ), /placeholder/ );
} );

test( 'klient: niepusty, jedna linia, bez zamknięcia komentarza', () => {
	assert.equal( walidujKlienta( 'Acme Sp. z o.o.' ), null );
	assert.notEqual( walidujKlienta( '  ' ), null );
	assert.notEqual( walidujKlienta( 'a\nb' ), null );
	assert.notEqual( walidujKlienta( 'zły */ klient' ), null );
} );

// ─── podmienTresc ───────────────────────────────────────────────────────────

test( 'slug motywu podmieniany przed prefiksem', () => {
	assert.equal( podmienTresc( "__( 'Menu', 'fwp-motyw' )", CFG ), "__( 'Menu', 'acme' )" );
	assert.equal(
		podmienTresc( '"wp-content/themes/fwp-motyw": "./theme"', CFG ),
		'"wp-content/themes/acme": "./theme"'
	);
	assert.equal( podmienTresc( '@package fwp-motyw', CFG ), '@package acme' );
} );

test( 'wszystkie formy prefiksu', () => {
	const przypadki = [
		[ 'function fwp_setup() {', 'function ac_setup() {' ],
		[ "define( 'FWP_VERSION', 1 );", "define( 'AC_VERSION', 1 );" ],
		[ '.fwp-container { width: var(--fwp-wrapper); }', '.ac-container { width: var(--ac-wrapper); }' ],
		[ '<main id="fwp-content">', '<main id="ac-content">' ],
		[ 'href="#fwp-content"', 'href="#ac-content"' ],
		[ "$_GET['fwp_empty']", "$_GET['ac_empty']" ],
		[ "'fwp-section-' . $slug", "'ac-section-' . $slug" ],
		[ 'const FWP_NOINDEX_HOSTS = array();', 'const AC_NOINDEX_HOSTS = array();' ],
		[ '<element value="fwp_"/>', '<element value="ac_"/>' ],
		[ '"name": "fwp/fwp-motyw"', '"name": "ac/acme"' ],
		[ 'group_fwp_home_hero', 'group_ac_home_hero' ],
		[ '"prefiks": "fwp"', '"prefiks": "ac"' ],
		[ 'mu-plugins/fwp-noindex-preview.php', 'mu-plugins/ac-noindex-preview.php' ],
	];
	for ( const [ przed, po ] of przypadki ) {
		assert.equal( podmienTresc( przed, CFG ), po, przed );
	}
} );

test( 'nazwa motywu zastępowana nazwą klienta', () => {
	assert.equal( podmienTresc( ' * Bootstrap motywu FWP Motyw.', CFG ), ' * Bootstrap motywu Acme Budownictwo.' );
} );

test( 'nie rusza fwp sklejonego z literami ani cyframi', () => {
	const bezZmian = [ 'xfwp_setup', 'fwpx', 'FWPX_Y', 'afwp-b', 'fwp2', 'Fwp' ];
	for ( const t of bezZmian ) {
		assert.equal( podmienTresc( t, CFG ), t, t );
	}
} );

test( 'jedno przejście: slug zawierający fwp nie zostaje zmiażdżony', () => {
	const cfg = { klient: 'Nowy', slug: 'fwp-nowy', prefiks: 'nw' };
	assert.equal( podmienTresc( "'fwp-motyw' fwp_x", cfg ), "'fwp-nowy' nw_x" );
} );

test( 'podmiana jest odporna na wielokrotne wystąpienia w linii', () => {
	assert.equal(
		podmienTresc( 'fwp_a(FWP_B, "fwp-motyw", .fwp-c, --fwp-d)', CFG ),
		'ac_a(AC_B, "acme", .ac-c, --ac-d)'
	);
} );

test( 'znajdzPozostalosci wskazuje formy, których reguły nie obejmują', () => {
	const tekst = podmienTresc( 'fwp_a\nFwpKlasa\nxfwp\nok', CFG );
	assert.deepEqual(
		znajdzPozostalosci( tekst ).map( ( p ) => p.linia ),
		[ 2, 3 ]
	);
} );

// ─── style.css, package.json ────────────────────────────────────────────────

test( 'ustawia Theme Name, zostawia resztę nagłówka', () => {
	const css = '/*\nTheme Name: FWP Motyw\nText Domain: fwp-motyw\n*/\n';
	const wynik = ustawNazweMotywu( podmienTresc( css, CFG ), CFG.klient );
	assert.equal( wynik, '/*\nTheme Name: Acme Budownictwo\nText Domain: acme\n*/\n' );
} );

test( 'package.json: nazwa {slug}-strona, skrypty i reszta zachowane', () => {
	const wejscie = JSON.stringify( {
		name: 'figma-wp-kit',
		scripts: { 'lint:php': 'wp-env run cli --env-cwd=wp-content/themes/fwp-motyw vendor/bin/phpcs' },
	} );
	const wynik = JSON.parse( ustawNazwePakietu( podmienTresc( wejscie, CFG ), CFG.slug ) );
	assert.equal( wynik.name, 'acme-strona' );
	assert.equal( wynik.scripts[ 'lint:php' ], 'wp-env run cli --env-cwd=wp-content/themes/acme vendor/bin/phpcs' );
} );

// ─── planZmianNazw ──────────────────────────────────────────────────────────

test( 'plan zmian nazw obejmuje tylko ścieżki z placeholderem', () => {
	const plan = planZmianNazw(
		[
			'mu-plugins/fwp-noindex-preview.php',
			'mu-plugins/fwp-tunnel-host.php',
			'theme/inc/setup.php',
			'theme/fwp-motyw-extra/fwp_x.php',
			'tools/tokens-to-css.mjs',
		],
		CFG
	);
	assert.deepEqual( plan, [
		{ z: 'mu-plugins/fwp-noindex-preview.php', na: 'mu-plugins/ac-noindex-preview.php' },
		{ z: 'mu-plugins/fwp-tunnel-host.php', na: 'mu-plugins/ac-tunnel-host.php' },
		{ z: 'theme/fwp-motyw-extra/fwp_x.php', na: 'theme/acme-extra/ac_x.php' },
	] );
} );

// ─── scalProjekt ────────────────────────────────────────────────────────────

const PROJEKT = {
	skonfigurowany: false,
	klient: '',
	slug: 'fwp-motyw',
	prefiks: 'fwp',
	urlLokalny: 'http://localhost:8888',
	figma: { fileKey: '', strona: '', stronaGlowna: { desktop: null, mobile: null } },
	szerokosciTestowe: { mobile: 393, tablet: 1024, desktop: 1440, wide: 1920 },
	kit: { sciezka: '~/figma-wp-kit', wersja: '0.1.0' },
};

test( 'scalProjekt ustawia dane klienta i Figmy', () => {
	const wynik = scalProjekt( PROJEKT, { ...CFG, fileKey: 'ABC123', nodeId: '470:29428' } );
	assert.equal( wynik.skonfigurowany, true );
	assert.equal( wynik.klient, 'Acme Budownictwo' );
	assert.equal( wynik.slug, 'acme' );
	assert.equal( wynik.prefiks, 'ac' );
	assert.equal( wynik.figma.fileKey, 'ABC123' );
	assert.equal( wynik.figma.stronaGlowna.desktop, '470:29428' );
} );

test( 'scalProjekt zachowuje wszystkie pola, których nie ustawia', () => {
	const wynik = scalProjekt( PROJEKT, { ...CFG, fileKey: 'ABC123', nodeId: null } );
	assert.deepEqual( wynik.kit, { sciezka: '~/figma-wp-kit', wersja: '0.1.0' } );
	assert.equal( wynik.urlLokalny, 'http://localhost:8888' );
	assert.deepEqual( wynik.szerokosciTestowe, PROJEKT.szerokosciTestowe );
	assert.equal( wynik.figma.strona, '' );
	assert.equal( wynik.figma.stronaGlowna.mobile, null );
	assert.equal( wynik.figma.stronaGlowna.desktop, null );

	// Nieznane pole dopisane przez inne narzędzie też przetrwa.
	const zDodatkiem = scalProjekt( { ...PROJEKT, cosNowego: { a: 1 } }, CFG );
	assert.deepEqual( zDodatkiem.cosNowego, { a: 1 } );
	assert.deepEqual( Object.keys( zDodatkiem ).sort(), [ ...Object.keys( PROJEKT ), 'cosNowego' ].sort() );
} );

test( 'scalProjekt nie modyfikuje wejścia', () => {
	const kopia = structuredClone( PROJEKT );
	scalProjekt( PROJEKT, { ...CFG, fileKey: 'X', nodeId: '1:2' } );
	assert.deepEqual( PROJEKT, kopia );
} );

test( 'scalProjekt radzi sobie z projekt.json bez sekcji figma', () => {
	const wynik = scalProjekt( { slug: 'fwp-motyw' }, { ...CFG, fileKey: 'K', nodeId: '1:2' } );
	assert.deepEqual( wynik.figma, { fileKey: 'K', stronaGlowna: { desktop: '1:2' } } );
} );

// ─── pozostałe ──────────────────────────────────────────────────────────────

test( 'propozycje sluga i prefiksu', () => {
	assert.equal( slugZNazwy( 'Łódzkie Żurawie Sp. z o.o.' ), 'lodzkie-zurawie-sp-z-o-o' );
	assert.equal( slugZNazwy( '3 Kolory' ), 'kolory' );
	assert.equal( prefiksZeSluga( 'acme-budownictwo' ), 'ab' );
	assert.equal( prefiksZeSluga( 'acme' ), 'acm' );
} );

test( 'argumenty: flagi z wartością osobno i po znaku =, dry-run', () => {
	assert.deepEqual(
		parsujArgumenty( [ '--klient', 'Test Sp.', '--slug=testowy', '--prefiks', 'tt', '--figma', 'https://x', '--dry-run' ] ),
		{ dryRun: true, pomoc: false, klient: 'Test Sp.', slug: 'testowy', prefiks: 'tt', figma: 'https://x' }
	);
	assert.throws( () => parsujArgumenty( [ '--nieznany', 'x' ] ), /Nieznany/ );
	assert.throws( () => parsujArgumenty( [ '--slug' ] ), /Brak wartości/ );
} );

test( 'wykrywanie plików binarnych', () => {
	assert.equal( czyBinarny( 'a/b.woff2' ), true );
	assert.equal( czyBinarny( 'a/B.PNG' ), true );
	assert.equal( czyBinarny( 'a/b.php', Buffer.from( '<?php' ) ), false );
	assert.equal( czyBinarny( 'a/b.dat', Buffer.from( [ 1, 0, 2 ] ) ), true );
} );
