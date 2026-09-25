import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFillArgs, extensionFromBytes, fillsEndpoint, planFillFiles } from './figma-fills.mjs';

test('parseFillArgs przyjmuje imageRef z opcjonalną nazwą po znaku =', () => {
  const opts = parseFillArgs(['abc123=hero-zdjecie', 'def456', '--out', 'x/y']);
  assert.deepEqual(opts.refs, [
    { ref: 'abc123', name: 'hero-zdjecie' },
    { ref: 'def456', name: null },
  ]);
  assert.equal(opts.out, 'x/y');
});

test('parseFillArgs bez argumentów zgłasza błąd', () => {
  assert.throws(() => parseFillArgs([]), /imageRef/);
});

test('extensionFromBytes rozpoznaje format po sygnaturze pliku', () => {
  assert.equal(extensionFromBytes(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d])), 'png');
  assert.equal(extensionFromBytes(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'jpg');
  assert.equal(extensionFromBytes(Buffer.from('RIFF0000WEBP', 'ascii')), 'webp');
  assert.equal(extensionFromBytes(Buffer.from('GIF89a', 'ascii')), 'gif');
  assert.equal(extensionFromBytes(Buffer.from([0, 1, 2, 3])), 'bin');
});

test('fillsEndpoint wskazuje listę wypełnień obrazów pliku', () => {
  assert.equal(fillsEndpoint('KEY'), 'https://api.figma.com/v1/files/KEY/images');
});

test('planFillFiles nazywa plik nazwą z argumentu albo samym imageRef', () => {
  const plan = planFillFiles([{ ref: 'abcdef1234', name: 'Zdjęcie zespołu' }, { ref: 'ffff0000', name: null }]);
  assert.deepEqual(plan, [
    { ref: 'abcdef1234', base: 'zdjecie-zespolu' },
    { ref: 'ffff0000', base: 'fill-ffff0000' },
  ]);
});
