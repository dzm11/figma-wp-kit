#!/usr/bin/env node
/**
 * Pobiera oryginalne pliki obrazów z wypełnień IMAGE w Figmie (po imageRef).
 *
 * Po co, skoro jest figma:assets: eksport węzła renderuje wszystko, co w nim
 * leży — gradient przykrywający zdjęcie, pływające karty, falę przycinającą
 * dół. Zdjęcie w sekcji potrzebuje czystego oryginału, a przykrycia sekcja
 * rysuje sama w CSS. imageRef (w API wtyczki: imageHash) podaje kontrakt sekcji.
 *
 * Użycie:
 *   npm run figma:fills -- <imageRef[=nazwa]...> [--out design-assets/raw]
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { isAbsolute, resolve as resolvePath, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { API, describeApiError, downloadBuffer, resolveToken } from './figma-export.mjs';
import { slugifyName, DEFAULT_OUT } from './figma-assets.mjs';
import { ROOT, readProjekt, requireFileKey } from './lib/projekt.mjs';

export function parseFillArgs(argv) {
  const refs = [];
  let out = DEFAULT_OUT;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') {
      out = argv[++i];
    } else if (!arg.startsWith('--')) {
      const [ref, name = null] = arg.split('=');
      refs.push({ ref, name });
    }
  }
  if (!refs.length) {
    throw new Error('Podaj co najmniej jeden imageRef (np. z kontraktu sekcji).');
  }
  return { refs, out };
}

export function extensionFromBytes(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  if (buf.subarray(0, 3).toString('ascii') === 'GIF') return 'gif';
  return 'bin';
}

export function fillsEndpoint(fileKey) {
  return `${API}/files/${fileKey}/images`;
}

export function planFillFiles(refs) {
  return refs.map(({ ref, name }) => ({ ref, base: name ? slugifyName(name) : `fill-${ref.slice(0, 8)}` }));
}

async function main() {
  const { refs, out } = parseFillArgs(process.argv.slice(2));
  const fileKey = requireFileKey(readProjekt());
  const token = resolveToken();
  const response = await fetch(fillsEndpoint(fileKey), { headers: { 'X-Figma-Token': token } });
  if (!response.ok) {
    throw new Error(describeApiError(response.status, await response.text()));
  }
  const urls = (await response.json()).meta?.images ?? {};
  const dir = isAbsolute(out) ? out : resolvePath(ROOT, out);
  mkdirSync(dir, { recursive: true });

  let saved = 0;
  for (const { ref, base } of planFillFiles(refs)) {
    if (!urls[ref]) {
      console.error(`${ref}: brak w pliku Figmy (sprawdź imageRef/imageHash).`);
      process.exitCode = 1;
      continue;
    }
    const buf = await downloadBuffer(urls[ref]);
    const path = resolvePath(dir, `${base}.${extensionFromBytes(buf)}`);
    writeFileSync(path, buf);
    saved++;
    console.log(`${ref}  ->  ${relative(process.cwd(), path)} (${Math.round(buf.length / 1024)} kB)`);
  }
  console.log(`Zapisano ${saved} z ${refs.length} obrazów.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
