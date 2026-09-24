/**
 * Punkt wejścia paska Agentation — narzędzia do zgłaszania uwag do designu.
 *
 * Agentation jest komponentem Reacta, a motyw jest klasycznym PHP bez Reacta,
 * więc montujemy go samodzielnie w osobnym węźle doklejonym do <body>.
 * Bundle powstaje przez `npm run agentation` i trafia do
 * theme/assets/js/agentation.bundle.js.
 *
 * Skrypt ładuje się WYŁĄCZNIE w środowisku lokalnym — patrz theme/inc/agentation.php.
 */

/* global __NAZWA_APLIKACJI__ -- podstawiane przez esbuild (define) w build.mjs */

import { createRoot } from 'react-dom/client';
import { Agentation } from 'agentation';

const host = document.createElement( 'div' );
host.id = 'fwp-agentation';
document.body.appendChild( host );

createRoot( host ).render(
	<Agentation appName={ __NAZWA_APLIKACJI__ } useHashLocation={ false } />
);
