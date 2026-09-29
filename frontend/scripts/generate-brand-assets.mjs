import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mark = JSON.parse(readFileSync(resolve(root, 'src/brand/mark.json'), 'utf8'));

function paths(mono = false) {
  return mark.parts.map(part =>
    `<path fill="${!mono && part.accent ? '#9999F7' : '#FAFAFA'}" fill-rule="evenodd" d="${part.d}"/>`
  ).join('');
}

writeFileSync(resolve(root, 'public/buildx-mark.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${mark.viewBox}">${paths()}</svg>\n`);
writeFileSync(resolve(root, 'public/buildx-mark-mono.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${mark.viewBox}">${paths(true)}</svg>\n`);
writeFileSync(resolve(root, 'public/favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 112"><rect width="112" height="112" rx="24" fill="#0A0A0B"/><svg x="5" y="5" width="102" height="102" viewBox="${mark.viewBox}">${paths()}</svg></svg>\n`);
