import { readFile, mkdir, copyFile, stat, chmod } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({ options: { source: { type: 'string' }, output: { type: 'string', default: '.cache/product-import' }, 'legacy-brochure': { type: 'string', default: 'Container House.pdf' } } });
if (!values.source) throw new Error('Usage: node tools/package-company-products.mjs --source "D:/Bolg/pro" [--output .cache/product-import]');
const catalogue = JSON.parse(await readFile('packages/contracts/company-products.json', 'utf8'));
const output = path.resolve(values.output);
await mkdir(path.join(output, 'images'), { recursive: true });
await mkdir(path.join(output, 'brochures'), { recursive: true });
let bytes = 0;
async function copy(source, destination, expected) {
  const data = await readFile(source);
  if (createHash('sha256').update(data).digest('hex') !== expected) throw new Error(`Checksum mismatch: ${source}`);
  if (path.resolve(source) !== path.resolve(destination)) {
    let same = false;
    try { same = createHash('sha256').update(await readFile(destination)).digest('hex') === expected; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!same) {
      try { await chmod(destination, 0o600); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      await copyFile(source, destination);
    }
  }
  bytes += (await stat(source)).size;
}
const keys = new Set(catalogue.products.flatMap(p => [p.imageUrl, ...p.galleryUrls]));
for (const key of keys) await copy(path.join('apps/web/public', key), path.join(output, 'images', path.basename(key)), catalogue.assets[key].sha256);
for (const brochure of Object.values(catalogue.brochures)) {
  const source = brochure.path === 'brochures/original-container.pdf' ? values['legacy-brochure'] : path.join(values.source, brochure.name);
  await copy(source, path.join(output, brochure.path), brochure.sha256);
}
console.log(JSON.stringify({ output, products: catalogue.products.length, images: keys.size, brochures: Object.keys(catalogue.brochures).length, megabytes: Math.round(bytes / 1e6) }));
