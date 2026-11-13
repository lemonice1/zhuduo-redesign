const path = require('node:path');
const { parseArgs } = require('node:util');

async function main() {
  const { values } = parseArgs({ options: { apply: { type: 'boolean', default: false }, locale: { type: 'string', default: 'ar' }, 'products-only': { type: 'boolean', default: false } } });
  if (!['ar', 'fr'].includes(values.locale)) throw new Error('Supported backfill locales: ar, fr.');
  process.env.SEED_DEMO_CONTENT = 'false';
  const { createStrapi } = require('@strapi/strapi');
  const app = createStrapi({ appDir: process.cwd(), distDir: path.join(process.cwd(), 'dist') });
  try {
    await app.load();
    const locales = app.plugin('i18n').service('locales');
    const existing = await locales.findByCode(values.locale);
    if (!existing && values.apply) await locales.create({ code: values.locale, name: values.locale === 'ar' ? 'Arabic (ar)' : 'French (fr)' });
    const { backfillLanguage } = require('../dist/src/lib/backfill-language.js');
    const results = await backfillLanguage(app, values.locale, values.apply, Boolean(existing || values.apply), { productsOnly: values['products-only'] });
    console.log(JSON.stringify({ applied: values.apply, locale: values.locale, localeStatus: existing || values.apply ? 'configured' : 'will be created with --apply', results }, null, 2));
  } finally { await require('./strapi-shutdown.cjs')(app); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
