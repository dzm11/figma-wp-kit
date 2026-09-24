import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ramkaPorownania,
  viewportPorownania,
  uzupelnijRamke,
  requireFileKey,
  baseUrl,
  viewportZakresu,
  OSTRZEZENIE_RAMKI,
} from './projekt.mjs';

const bazowy = {
  urlLokalny: 'http://localhost:8888',
  figma: { fileKey: 'KEY' },
  szerokosciTestowe: { mobile: 393, tablet: 1024, desktop: 1440, wide: 1920 },
};
const zRamkami = { ...bazowy, figma: { fileKey: 'KEY', ramki: { desktop: 1440, mobile: 375 } } };

test('ramkaPorownania czyta szerokość z figma.ramki', () => {
  assert.deepEqual(ramkaPorownania(zRamkami, 'desktop'), { width: 1440, brakRamki: false });
  assert.deepEqual(ramkaPorownania(zRamkami, 'mobile'), { width: 375, brakRamki: false });
});

test('ramkaPorownania bez figma.ramki spada na wide / mobile z szerokości testowych', () => {
  assert.deepEqual(ramkaPorownania(bazowy, 'desktop'), { width: 1920, brakRamki: true });
  assert.deepEqual(ramkaPorownania(bazowy, 'mobile'), { width: 393, brakRamki: true });
});

test('ramkaPorownania: brak tylko jednej ramki spada tylko dla niej', () => {
  const polowa = { ...bazowy, figma: { fileKey: 'KEY', ramki: { desktop: 1280 } } };
  assert.deepEqual(ramkaPorownania(polowa, 'desktop'), { width: 1280, brakRamki: false });
  assert.deepEqual(ramkaPorownania(polowa, 'mobile'), { width: 393, brakRamki: true });
});

test('viewportPorownania z ramkami: szerokość ramki, bez ostrzeżenia', () => {
  const ostrzezenia = [];
  assert.deepEqual(viewportPorownania(zRamkami, 'desktop', (m) => ostrzezenia.push(m)), { width: 1440, height: 1080 });
  assert.deepEqual(viewportPorownania(zRamkami, 'mobile', (m) => ostrzezenia.push(m)), { width: 375, height: 852 });
  assert.deepEqual(ostrzezenia, []);
});

test('viewportPorownania bez ramek ostrzega, że trzeba uzupełnić figma.ramki', () => {
  const ostrzezenia = [];
  assert.deepEqual(viewportPorownania(bazowy, 'desktop', (m) => ostrzezenia.push(m)), { width: 1920, height: 1080 });
  assert.equal(ostrzezenia.length, 1);
  assert.match(ostrzezenia[0], /figma\.ramki\.desktop/);
  assert.ok(ostrzezenia[0].includes(OSTRZEZENIE_RAMKI));
  assert.equal(OSTRZEZENIE_RAMKI, 'uzupełnij figma.ramki w projekt.json (faza rekonesansu)');
});

test('uzupelnijRamke dopisuje brakującą szerokość, zaokrągloną, nie ruszając reszty', () => {
  const wynik = uzupelnijRamke(bazowy, 'mobile', 374.6);
  assert.deepEqual(wynik.figma, { fileKey: 'KEY', ramki: { mobile: 375 } });
  assert.equal(bazowy.figma.ramki, undefined, 'wejście nie może być mutowane');
  const drugi = uzupelnijRamke(wynik, 'desktop', 1440);
  assert.deepEqual(drugi.figma.ramki, { mobile: 375, desktop: 1440 });
});

test('uzupelnijRamke nie nadpisuje wartości ustawionej ręcznie i odrzuca złą szerokość', () => {
  assert.equal(uzupelnijRamke(zRamkami, 'desktop', 1920), null);
  assert.equal(uzupelnijRamke(bazowy, 'desktop', 0), null);
  assert.equal(uzupelnijRamke(bazowy, 'desktop', undefined), null);
});

test('requireFileKey odsyła do npm run setup, gdy klucza brak', () => {
  assert.equal(requireFileKey(bazowy), 'KEY');
  assert.throws(() => requireFileKey({ figma: { fileKey: '' } }), /npm run setup/);
});

test('baseUrl dokleja ukośnik, viewportZakresu bierze szerokości testowe', () => {
  assert.equal(baseUrl(bazowy), 'http://localhost:8888/');
  assert.deepEqual(viewportZakresu(bazowy, 'tablet'), { width: 1024, height: 900 });
  assert.throws(() => viewportZakresu({ szerokosciTestowe: {} }, 'wide'), /wide/);
});
