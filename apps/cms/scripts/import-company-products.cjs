const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { parseArgs } = require('node:util');

async function main() {
  const { values } = parseArgs({ options: { bundle: { type: 'string' }, apply: { type: 'boolean', default: false } } });
  if (!values.bundle) throw new Error('Usage: npm run import:products -- --bundle /path/to/product-import [--apply]');
  const catalogue = require('@modular/contracts/company-products.json');
  const bundle = await fs.realpath(values.bundle);
  const assets = new Map();
  for (const product of catalogue.products) {
    for (const key of [product.imageUrl, ...(product.galleryUrls ?? [])]) assets.set(key, {
      file: path.join(bundle, 'images', path.basename(key)), sha256: catalogue.assets[key].sha256
    });
    if (product.brochureKey) {
      const brochure = catalogue.brochures[product.brochureKey];
      assets.set(brochure.path, { file: path.join(bundle, brochure.path), sha256: brochure.sha256 });
    }
  }
  // Check the entire bundle before opening Strapi or uploading anything.
  for (const [key, asset] of assets) {
    asset.file = await fs.realpath(asset.file);
    if (!asset.file.startsWith(bundle + path.sep)) throw new Error(`Asset outside bundle: ${key}`);
    const data = await fs.readFile(asset.file);
    if (createHash('sha256').update(data).digest('hex') !== asset.sha256) throw new Error(`Asset checksum mismatch: ${key}`);
  }
  process.env.SEED_DEMO_CONTENT = 'false';
  const { createStrapi } = require('@strapi/strapi');
  const app = createStrapi({ appDir: process.cwd(), distDir: path.join(process.cwd(), 'dist') });
  try {
    await app.load();
    for (const code of ['en', 'zh-Hans']) if (!await app.plugin('i18n').service('locales').findByCode(code)) {
      if (!values.apply) throw new Error(`Add the ${code} locale in Strapi before importing.`);
      await app.plugin('i18n').service('locales').create({ code, name: code === 'en' ? 'English (en)' : 'Chinese (Simplified) (zh-Hans)' });
    }
    const { importCompanyCatalogue } = require('../dist/src/lib/catalogue-import.js');
    const results = await importCompanyCatalogue(app, catalogue, { apply: values.apply, uploadAsset: async (key, title) => {
      const asset = assets.get(key);
      const name = `zhuduo-${asset.sha256}${path.extname(asset.file)}`;
      const existing = await app.db.query('plugin::upload.file').findOne({ where: { name } });
      if (existing) return existing.id;
      const stat = await fs.stat(asset.file);
      const [file] = await app.plugin('upload').service('upload').upload({
        data: { fileInfo: { name, alternativeText: title, caption: title } },
        files: { filepath: asset.file, originalFilename: name, mimetype: name.endsWith('.pdf') ? 'application/pdf' : 'image/webp', size: stat.size }
      });
      return file.id;
    } });
    console.log(JSON.stringify({ applied: values.apply, products: results.length, results }, null, 2));
  } finally { await require('./strapi-shutdown.cjs')(app); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
