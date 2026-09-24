import { defineConfig, devices } from '@playwright/test';
import { readProjekt, baseUrl, viewportZakresu } from './tools/lib/projekt.mjs';

// Adres i szerokości pochodzą z projekt.json — jeden projekt na zakres
// breakpointów ze specyfikacji, po jednej szerokości testowej na zakres.
// Dodajesz zakres w spec — dodaj go w projekt.json.szerokosciTestowe i tutaj,
// inaczej zostanie bez pokrycia.
const projekt = readProjekt();
const ZAKRESY = ['mobile', 'tablet', 'desktop', 'wide'];

export default defineConfig({
  testDir: './theme/tests/e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: baseUrl(projekt),
    deviceScaleFactor: 1,
    screenshot: 'only-on-failure',
  },
  projects: ZAKRESY.map((name) => ({
    name,
    use: { ...devices['Desktop Chrome'], viewport: viewportZakresu(projekt, name) },
  })),
});
