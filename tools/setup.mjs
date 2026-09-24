/**
 * Konfiguracja zestawu pod konkretnego klienta (npm run setup).
 *
 * Zestaw startowy używa placeholderów: prefiksu `fwp` (funkcje fwp_, stałe FWP_,
 * klasy .fwp-, zmienne CSS --fwp-) i sluga motywu `fwp-motyw`. Ten skrypt
 * podmienia je raz, na początku projektu, i zapisuje dane klienta do projekt.json.
 *
 * Użycie:
 *   npm run setup                                   tryb interaktywny
 *   npm run setup -- --klient "Acme" --slug acme --prefiks ac \
 *                    --figma "https://www.figma.com/design/KEY/Nazwa?node-id=1-2"
 *   npm run setup -- ... --dry-run                  sam plan, bez zapisu
 *
 * Logika podmiany żyje w czystych funkcjach eksportowanych niżej i jest pokryta
 * testami (tools/setup.test.mjs); main() tylko zbiera pliki i zapisuje wynik.
 */

import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmdirSync,
	statSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Placeholdery zestawu. Setup je zastępuje i od tej chwili nie istnieją.
export const PLACEHOLDER = {
	slug: 'fwp-motyw',
	prefiks: 'fwp',
	nazwaMotywu: 'FWP Motyw',
};

const ROOT = resolve( dirname( fileURLToPath( import.meta.url ) ), '..' );

/*
 * Gdzie podmieniamy. Katalogi przeszukujemy rekurencyjnie; pojedyncze pliki
 * wprost. Świadomie poza listą: CLAUDE.md, README.md, docs/decyzje — opisują
 * zestaw i jego placeholdery, więc podmiana zrobiłaby z nich nieprawdę.
 */
export const CELE = [
	'theme',
	'mu-plugins',
	'tools',
	'docs/figma',
	'docs/wdrozenie.md',
	'playwright.config.mjs',
	'.wp-env.json',
	'package.json',
];

// Ścieżki (względem katalogu projektu) pomijane w całości.
const POMIJANE_KATALOGI = new Set( [ 'node_modules', 'vendor', '.git', '__diff__' ] );
const POMIJANE_PLIKI = new Set( [
	'tools/setup.mjs',
	'tools/setup.test.mjs',
	// Bundle generowany, w .gitignore — odbuduje go npm run agentation.
	'theme/assets/js/agentation.bundle.js',
] );

const ROZSZERZENIA_BINARNE = new Set( [
	'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'ico', 'bmp', 'tif', 'tiff',
	'woff', 'woff2', 'ttf', 'otf', 'eot',
	'pdf', 'zip', 'gz', 'tgz', 'mp4', 'webm', 'mov', 'mp3', 'wav',
] );

// ─── Walidacja ──────────────────────────────────────────────────────────────

/**
 * @returns {string|null} Komunikat błędu albo null, gdy prefiks jest poprawny.
 */
export function walidujPrefiks( prefiks ) {
	if ( typeof prefiks !== 'string' || ! /^[a-z][a-z0-9]{1,5}$/.test( prefiks ) ) {
		return 'Prefiks: 2–6 znaków, małe litery i cyfry, zaczyna się literą (np. "ac").';
	}
	if ( prefiks === PLACEHOLDER.prefiks ) {
		return `Prefiks "${ PLACEHOLDER.prefiks }" to placeholder zestawu — wybierz własny.`;
	}
	return null;
}

/**
 * @returns {string|null} Komunikat błędu albo null, gdy slug jest poprawny.
 */
export function walidujSlug( slug ) {
	if ( typeof slug !== 'string' || ! /^[a-z][a-z0-9-]{2,40}$/.test( slug ) ) {
		return 'Slug: 3–41 znaków, małe litery, cyfry i myślniki, zaczyna się literą (np. "acme").';
	}
	if ( slug === PLACEHOLDER.slug ) {
		return `Slug "${ PLACEHOLDER.slug }" to placeholder zestawu — wybierz własny.`;
	}
	return null;
}

/**
 * Nazwa klienta trafia do nagłówka style.css i komentarzy PHP, więc nie może
 * zawierać końca linii ani zamknięcia komentarza.
 *
 * @returns {string|null}
 */
export function walidujKlienta( klient ) {
	if ( typeof klient !== 'string' || klient.trim() === '' ) {
		return 'Nazwa klienta nie może być pusta.';
	}
	if ( klient.length > 80 || /[\r\n]/.test( klient ) || klient.includes( '*/' ) ) {
		return 'Nazwa klienta: jedna linia, do 80 znaków, bez "*/".';
	}
	return null;
}

// ─── Figma ──────────────────────────────────────────────────────────────────

/**
 * Wyciąga klucz pliku i opcjonalny identyfikator węzła z adresu Figmy.
 *
 * Obsługuje /design/, /file/ i /proto/, node-id w formie "470-29428",
 * "470:29428" i zakodowanej "470%3A29428". Węzeł zwraca w formie z API
 * i wtyczki Figmy: "470:29428".
 *
 * @param {string} wejscie Adres URL albo sam klucz pliku.
 * @returns {{ fileKey: string, nodeId: string|null }}
 */
export function parsujUrlFigmy( wejscie ) {
	const tekst = String( wejscie ?? '' ).trim();

	if ( /^[A-Za-z0-9]{10,}$/.test( tekst ) ) {
		return { fileKey: tekst, nodeId: null };
	}

	let url;
	try {
		url = new URL( tekst );
	} catch {
		throw new Error( `To nie jest adres Figmy: "${ tekst }".` );
	}

	if ( ! /(^|\.)figma\.com$/.test( url.hostname ) ) {
		throw new Error( `Adres nie prowadzi do figma.com: "${ tekst }".` );
	}

	const dopasowanie = url.pathname.match( /^\/(?:design|file|proto)\/([A-Za-z0-9]+)(?:\/|$)/ );
	if ( ! dopasowanie ) {
		throw new Error( `Nie znalazłem klucza pliku w adresie: "${ tekst }".` );
	}

	const surowyWezel = url.searchParams.get( 'node-id' );
	let nodeId = null;
	if ( surowyWezel ) {
		const wezel = surowyWezel.replace( '-', ':' );
		if ( ! /^\d+:\d+$/.test( wezel ) ) {
			throw new Error( `Nieczytelny node-id: "${ surowyWezel }".` );
		}
		nodeId = wezel;
	}

	return { fileKey: dopasowanie[ 1 ], nodeId };
}

// ─── Podmiana ───────────────────────────────────────────────────────────────

/*
 * Jedno wyrażenie, jedno przejście — kolejność alternatyw jest kolejnością
 * reguł, a podmieniony tekst nie jest skanowany ponownie:
 *
 *   1. "fwp-motyw"  → slug       (przed regułą prefiksu, inaczej wyszłoby "abc-motyw")
 *   2. "FWP Motyw"  → klient     (nazwa motywu w style.css i komentarzach)
 *   3. "FWP"        → "ABC"      (stałe FWP_*, samodzielne słowo)
 *   4. "fwp"        → "abc"      (fwp_, fwp-, .fwp-, --fwp-, #fwp-, ?fwp_empty)
 *
 * Reguły 3 i 4 dotyczą tylko fwp jako osobnego członu: przed nim i po nim nie
 * może stać litera ani cyfra. "_" i "-" są separatorami, więc FWP_VERSION,
 * fwp_field i --fwp-gutter pasują, a słowo zawierające "fwp" w środku — nie.
 *
 * Jedno przejście chroni też przed zmiażdżeniem wyniku: slug wolno nazwać
 * np. "fwp-nowy" i reguła 4 go już nie dotknie.
 */
const WZORZEC =
	/(?<![A-Za-z0-9])(?:(fwp-motyw)(?![A-Za-z0-9])|(FWP Motyw)(?![A-Za-z0-9])|(FWP)(?![A-Za-z0-9])|(fwp)(?![A-Za-z0-9]))/g;

/**
 * Podmienia placeholdery w treści pliku.
 *
 * @param {string} tresc
 * @param {{ slug: string, prefiks: string, klient: string }} cfg
 * @returns {string}
 */
export function podmienTresc( tresc, cfg ) {
	return tresc.replace( WZORZEC, ( _, slug, nazwa, duzy, maly ) => {
		if ( slug ) return cfg.slug;
		if ( nazwa ) return cfg.klient;
		if ( duzy ) return cfg.prefiks.toUpperCase();
		if ( maly ) return cfg.prefiks;
		return _;
	} );
}

/**
 * Zwraca wystąpienia "fwp" (dowolna wielkość liter), które przetrwały podmianę —
 * np. "Fwp" albo "fwp" sklejone z literą. Tych skrypt celowo nie zgaduje.
 *
 * @returns {{ linia: number, tekst: string }[]}
 */
export function znajdzPozostalosci( tresc ) {
	const wynik = [];
	tresc.split( '\n' ).forEach( ( linia, i ) => {
		if ( /fwp/i.test( linia ) ) {
			wynik.push( { linia: i + 1, tekst: linia.trim().slice( 0, 160 ) } );
		}
	} );
	return wynik;
}

/**
 * Ustawia nazwę motywu w nagłówku style.css.
 */
export function ustawNazweMotywu( tresc, klient ) {
	return tresc.replace( /^(\s*Theme Name:).*$/m, `$1 ${ klient }` );
}

/**
 * Ustawia pole "name" w package.json na "{slug}-strona", zachowując resztę.
 */
export function ustawNazwePakietu( tresc, slug ) {
	const pakiet = JSON.parse( tresc );
	pakiet.name = `${ slug }-strona`;
	return JSON.stringify( pakiet, null, 2 ) + '\n';
}

/**
 * Plan zmian nazw: dla każdej ścieżki (względnej, z "/"), której człon zawiera
 * placeholder, zwraca parę { z, na }. Podmiana idzie tymi samymi regułami co
 * treść, więc nazwa pliku i odwołania do niej w kodzie zawsze się zgadzają.
 *
 * @param {string[]} sciezki
 * @returns {{ z: string, na: string }[]}
 */
export function planZmianNazw( sciezki, cfg ) {
	return sciezki
		.map( ( z ) => ( {
			z,
			na: z
				.split( '/' )
				.map( ( czlon ) => podmienTresc( czlon, cfg ) )
				.join( '/' ),
		} ) )
		.filter( ( { z, na } ) => z !== na );
}

/**
 * Scala dane klienta z istniejącym projekt.json. Pola, których setup nie
 * ustawia, zostają nietknięte — projekt.json współdzielą inne narzędzia.
 *
 * @param {object} projekt Obecna zawartość projekt.json.
 * @param {{ klient: string, slug: string, prefiks: string, fileKey?: string, nodeId?: string|null }} cfg
 * @returns {object} Nowy obiekt; wejście nie jest modyfikowane.
 */
export function scalProjekt( projekt, cfg ) {
	const figma = projekt.figma && typeof projekt.figma === 'object' ? projekt.figma : {};
	const stronaGlowna =
		figma.stronaGlowna && typeof figma.stronaGlowna === 'object' ? figma.stronaGlowna : {};

	return {
		...projekt,
		skonfigurowany: true,
		klient: cfg.klient,
		slug: cfg.slug,
		prefiks: cfg.prefiks,
		figma: {
			...figma,
			fileKey: cfg.fileKey || figma.fileKey || '',
			stronaGlowna: {
				...stronaGlowna,
				desktop: cfg.nodeId || stronaGlowna.desktop || null,
			},
		},
	};
}

/**
 * Proponuje slug z nazwy klienta: bez polskich znaków, małe litery, myślniki.
 */
export function slugZNazwy( nazwa ) {
	return String( nazwa )
		.normalize( 'NFD' )
		.replace( /[̀-ͯ]/g, '' )
		.replace( /ł/g, 'l' )
		.replace( /Ł/g, 'L' )
		.toLowerCase()
		.replace( /[^a-z0-9]+/g, '-' )
		.replace( /^[^a-z]+/, '' )
		.replace( /-+$/, '' )
		.slice( 0, 41 )
		.replace( /-+$/, '' );
}

/**
 * Proponuje prefiks ze sluga: pierwsze litery członów, a przy jednym członie
 * jego pierwsze trzy znaki.
 */
export function prefiksZeSluga( slug ) {
	const czlony = String( slug ).split( '-' ).filter( Boolean );
	const kandydat =
		czlony.length > 1 ? czlony.map( ( c ) => c[ 0 ] ).join( '' ).slice( 0, 6 ) : ( czlony[ 0 ] || '' ).slice( 0, 3 );
	return kandydat;
}

/**
 * Czyta argumenty wiersza poleceń.
 *
 * @param {string[]} argv
 * @returns {{ klient?: string, slug?: string, prefiks?: string, figma?: string, dryRun: boolean, pomoc: boolean }}
 */
export function parsujArgumenty( argv ) {
	const wynik = { dryRun: false, pomoc: false };
	const zWartoscia = new Set( [ 'klient', 'slug', 'prefiks', 'figma' ] );

	for ( let i = 0; i < argv.length; i++ ) {
		const arg = argv[ i ];
		if ( arg === '--dry-run' ) {
			wynik.dryRun = true;
			continue;
		}
		if ( arg === '--help' || arg === '-h' ) {
			wynik.pomoc = true;
			continue;
		}
		const m = arg.match( /^--([a-z-]+)(?:=(.*))?$/ );
		if ( ! m || ! zWartoscia.has( m[ 1 ] ) ) {
			throw new Error( `Nieznany argument: ${ arg }` );
		}
		let wartosc = m[ 2 ];
		if ( wartosc === undefined ) {
			wartosc = argv[ ++i ];
			if ( wartosc === undefined ) {
				throw new Error( `Brak wartości dla --${ m[ 1 ] }` );
			}
		}
		wynik[ m[ 1 ] ] = wartosc;
	}

	return wynik;
}

/**
 * Czy plik traktować jako binarny: po rozszerzeniu albo po bajcie zerowym.
 */
export function czyBinarny( sciezka, bufor ) {
	const rozszerzenie = sciezka.split( '.' ).pop().toLowerCase();
	if ( ROZSZERZENIA_BINARNE.has( rozszerzenie ) ) {
		return true;
	}
	return bufor ? bufor.subarray( 0, 8000 ).includes( 0 ) : false;
}

// ─── Operacje na dysku ──────────────────────────────────────────────────────

function posix( sciezka ) {
	return sciezka.split( sep ).join( '/' );
}

/**
 * Zbiera ścieżki plików (względne, z "/") ze wszystkich celów.
 */
function zbierzPliki( root ) {
	const pliki = [];

	const przejdz = ( abs ) => {
		const rel = posix( relative( root, abs ) );
		const stat = statSync( abs );

		if ( stat.isDirectory() ) {
			if ( POMIJANE_KATALOGI.has( abs.split( sep ).pop() ) ) {
				return;
			}
			for ( const wpis of readdirSync( abs ).sort() ) {
				przejdz( join( abs, wpis ) );
			}
			return;
		}

		if ( stat.isFile() && ! POMIJANE_PLIKI.has( rel ) ) {
			pliki.push( rel );
		}
	};

	for ( const cel of CELE ) {
		const abs = join( root, cel );
		if ( existsSync( abs ) ) {
			przejdz( abs );
		}
	}

	return pliki;
}

/**
 * Wylicza pełny plan zmian bez dotykania dysku.
 */
function zaplanuj( root, cfg ) {
	const pliki = zbierzPliki( root );
	const zmianyTresci = [];
	const pozostalosci = [];

	for ( const rel of pliki ) {
		const bufor = readFileSync( join( root, rel ) );
		if ( czyBinarny( rel, bufor ) ) {
			continue;
		}

		const przed = bufor.toString( 'utf8' );
		let po = podmienTresc( przed, cfg );

		if ( rel === 'theme/style.css' ) {
			po = ustawNazweMotywu( po, cfg.klient );
		}
		if ( rel === 'package.json' ) {
			po = ustawNazwePakietu( po, cfg.slug );
		}

		if ( po !== przed ) {
			const liczba = ( przed.match( WZORZEC ) || [] ).length;
			zmianyTresci.push( { rel, po, liczba } );
		}

		for ( const p of znajdzPozostalosci( po ) ) {
			pozostalosci.push( { rel, ...p } );
		}
	}

	const zmianyNazw = planZmianNazw( pliki, cfg );

	return { pliki, zmianyTresci, zmianyNazw, pozostalosci };
}

/**
 * Usuwa puste katalogi pozostałe po przeniesieniu plików, idąc w górę
 * aż do katalogu projektu.
 */
function usunPusteKatalogi( root, rel ) {
	let katalog = dirname( join( root, rel ) );
	while ( katalog.startsWith( root + sep ) && readdirSync( katalog ).length === 0 ) {
		rmdirSync( katalog );
		katalog = dirname( katalog );
	}
}

function wykonaj( root, plan ) {
	const tresci = new Map( plan.zmianyTresci.map( ( z ) => [ z.rel, z.po ] ) );

	for ( const [ rel, po ] of tresci ) {
		writeFileSync( join( root, rel ), po );
	}

	for ( const { z, na } of plan.zmianyNazw ) {
		const cel = join( root, na );
		mkdirSync( dirname( cel ), { recursive: true } );
		writeFileSync( cel, readFileSync( join( root, z ) ) );
		unlinkSync( join( root, z ) );
		usunPusteKatalogi( root, z );
	}
}

// ─── Interakcja ─────────────────────────────────────────────────────────────

async function dopytaj( dane ) {
	const brakuje = [ 'klient', 'slug', 'prefiks', 'figma' ].filter( ( k ) => dane[ k ] === undefined );
	if ( brakuje.length === 0 ) {
		return dane;
	}

	if ( ! process.stdin.isTTY ) {
		const wymagane = brakuje.filter( ( k ) => k !== 'figma' );
		if ( wymagane.length ) {
			throw new Error(
				`Brak ${ wymagane.map( ( k ) => '--' + k ).join( ', ' ) } i nie ma terminala, żeby o nie zapytać.`
			);
		}
		return { ...dane, figma: '' };
	}

	const { createInterface } = await import( 'node:readline/promises' );
	const rl = createInterface( { input: process.stdin, output: process.stdout } );
	const wynik = { ...dane };

	const zapytaj = async ( klucz, pytanie, domyslna, walidator ) => {
		if ( wynik[ klucz ] !== undefined ) {
			return;
		}
		for ( ;; ) {
			const podpowiedz = domyslna ? ` [${ domyslna }]` : '';
			const odp = ( await rl.question( `${ pytanie }${ podpowiedz }: ` ) ).trim() || domyslna || '';
			const blad = walidator( odp );
			if ( ! blad ) {
				wynik[ klucz ] = odp;
				return;
			}
			console.log( `  ${ blad }` );
		}
	};

	try {
		await zapytaj( 'klient', 'Nazwa klienta (np. „Acme Budownictwo”)', '', walidujKlienta );
		await zapytaj( 'slug', 'Slug motywu', slugZNazwy( wynik.klient ), walidujSlug );
		await zapytaj( 'prefiks', 'Prefiks kodu (funkcje, klasy CSS)', prefiksZeSluga( wynik.slug ), walidujPrefiks );
		await zapytaj( 'figma', 'Adres pliku Figmy albo ramki strony głównej (Enter = później)', '', ( v ) => {
			if ( v === '' ) return null;
			try {
				parsujUrlFigmy( v );
				return null;
			} catch ( e ) {
				return e.message;
			}
		} );
	} finally {
		rl.close();
	}

	return wynik;
}

function wypiszPomoc() {
	console.log( `Użycie:
  npm run setup
  npm run setup -- --klient "Nazwa" --slug nazwa-motywu --prefiks abc --figma "<URL Figmy>" [--dry-run]

  --klient   nazwa klienta (nazwa motywu w panelu, pasek uwag)
  --slug     slug motywu: katalog w wp-content/themes, text domain
  --prefiks  prefiks kodu: funkcje abc_, stałe ABC_, klasy .abc-, zmienne --abc-
  --figma    adres pliku lub ramki desktop strony głównej (node-id opcjonalny)
  --dry-run  wypisz plan i niczego nie zapisuj` );
}

// ─── main ───────────────────────────────────────────────────────────────────

async function main() {
	const argumenty = parsujArgumenty( process.argv.slice( 2 ) );
	if ( argumenty.pomoc ) {
		wypiszPomoc();
		return;
	}

	const sciezkaProjektu = join( ROOT, 'projekt.json' );
	const projekt = JSON.parse( readFileSync( sciezkaProjektu, 'utf8' ) );

	if ( projekt.skonfigurowany === true ) {
		throw new Error(
			`Projekt jest już skonfigurowany (klient: "${ projekt.klient }", slug: "${ projekt.slug }", ` +
				`prefiks: "${ projekt.prefiks }"). Setup uruchamia się raz — placeholderów już nie ma, ` +
				'więc drugi przebieg nie miałby czego podmienić. Zmiany wprowadzaj ręcznie.'
		);
	}

	const { dryRun, pomoc, ...podane } = argumenty;
	const dane = await dopytaj( podane );

	const bledy = [
		walidujKlienta( dane.klient ),
		walidujSlug( dane.slug ),
		walidujPrefiks( dane.prefiks ),
	].filter( Boolean );
	if ( bledy.length ) {
		throw new Error( bledy.join( '\n' ) );
	}

	const figma = dane.figma ? parsujUrlFigmy( dane.figma ) : { fileKey: '', nodeId: null };
	const cfg = { klient: dane.klient.trim(), slug: dane.slug, prefiks: dane.prefiks };

	const plan = zaplanuj( ROOT, cfg );
	const nowyProjekt = scalProjekt( projekt, { ...cfg, ...figma } );

	console.log( `\n${ dryRun ? 'Plan (--dry-run, nic nie zapisuję)' : 'Konfiguruję projekt' }:` );
	console.log( `  klient:  ${ cfg.klient }` );
	console.log( `  slug:    ${ PLACEHOLDER.slug } → ${ cfg.slug }` );
	console.log( `  prefiks: ${ PLACEHOLDER.prefiks } → ${ cfg.prefiks } (${ PLACEHOLDER.prefiks.toUpperCase() }_ → ${ cfg.prefiks.toUpperCase() }_)` );
	console.log( `  figma:   ${ figma.fileKey || '(brak — uzupełnij później w projekt.json)' }` +
		( figma.nodeId ? `, ramka desktop ${ figma.nodeId }` : '' ) );

	console.log( `\nPodmiana treści: ${ plan.zmianyTresci.length } z ${ plan.pliki.length } plików` );
	for ( const z of plan.zmianyTresci ) {
		console.log( `  ${ z.rel } (${ z.liczba })` );
	}

	console.log( `\nZmiana nazw: ${ plan.zmianyNazw.length }` );
	for ( const { z, na } of plan.zmianyNazw ) {
		console.log( `  ${ z } → ${ na }` );
	}

	console.log( '\nprojekt.json:' );
	console.log( JSON.stringify( nowyProjekt, null, 2 ).replace( /^/gm, '  ' ) );

	if ( plan.pozostalosci.length ) {
		console.log( `\nUwaga: ${ plan.pozostalosci.length } wystąpień "fwp", których reguły nie obejmują — popraw ręcznie:` );
		for ( const p of plan.pozostalosci ) {
			console.log( `  ${ p.rel }:${ p.linia }  ${ p.tekst }` );
		}
	}

	if ( dryRun ) {
		console.log( '\nTo był przebieg próbny. Uruchom bez --dry-run, żeby zapisać.' );
		return;
	}

	wykonaj( ROOT, plan );
	writeFileSync( sciezkaProjektu, JSON.stringify( nowyProjekt, null, 2 ) + '\n' );

	console.log( `
Gotowe. Kolejne kroki:
  1. cp .env.example .env i wpisz FIGMA_TOKEN (instrukcja w pliku)
  2. npm install
  3. npm run env:start        WordPress na ${ projekt.urlLokalny || 'http://localhost:8888' }
  4. npm run sprawdz          sprawdzenie środowiska przed pracą` );
}

if ( process.argv[ 1 ] && resolve( process.argv[ 1 ] ) === fileURLToPath( import.meta.url ) ) {
	main().catch( ( e ) => {
		console.error( `\n${ e.message }` );
		process.exit( 1 );
	} );
}
