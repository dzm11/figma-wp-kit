/**
 * Buduje bundle paska Agentation (npm run agentation).
 *
 * Narzędzie deweloperskie: React i sam Agentation są zależnościami dev,
 * a wynikowy plik ładuje się tylko w środowisku lokalnym (theme/inc/agentation.php).
 * Nie wchodzi do żadnego buildu produkcyjnego i jest w .gitignore.
 *
 * Nazwa aplikacji widoczna w pasku pochodzi z projekt.json (pole "klient")
 * i jest wstrzykiwana w czasie budowania — po zmianie nazwy klienta zbuduj
 * bundle ponownie.
 */

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname( fileURLToPath( import.meta.url ) );
const root = resolve( here, '../..' );
const out = resolve( root, 'theme/assets/js/agentation.bundle.js' );

/**
 * Czyta nazwę klienta z projekt.json; przy braku pliku lub pustym polu
 * zwraca neutralne „Strona”, żeby build nigdy nie padał z tego powodu.
 */
function appName() {
	try {
		const projekt = JSON.parse( readFileSync( resolve( root, 'projekt.json' ), 'utf8' ) );
		const klient = typeof projekt.klient === 'string' ? projekt.klient.trim() : '';
		return klient || 'Strona';
	} catch {
		return 'Strona';
	}
}

await build( {
	entryPoints: [ resolve( here, 'entry.jsx' ) ],
	outfile: out,
	bundle: true,
	format: 'iife',
	target: 'es2020',
	jsx: 'automatic',
	minify: true,
	define: {
		// Pasek ma działać tak, jak w trybie deweloperskim aplikacji Reacta.
		'process.env.NODE_ENV': '"development"',
		__NAZWA_APLIKACJI__: JSON.stringify( appName() ),
	},
	logLevel: 'info',
} );
