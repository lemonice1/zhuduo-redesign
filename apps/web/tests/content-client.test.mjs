import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { load, withEnvironment } from './compiled-web.mjs';

async function withCms(body, run, status = 200) {
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push({ url: request.url, headers: request.headers });
    response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await withEnvironment({ NODE_ENV: 'production', STRAPI_PUBLIC_URL: `http://127.0.0.1:${server.address().port}`, STRAPI_SERVER_TOKEN: 'private-content-secret' }, () => run(load('lib/content.js').loadHomepage, requests));
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

test('published homepage data becomes safe typed values without duplicate keys or unsafe images', async () => {
  await withCms({ products: [
    { slug: 'module-a', title: 'Module A', category: {}, eyebrow: null, summary: 12, detail: {}, options: ['Window', 'Window', 12], tone: 'evil', imageUrl: 'javascript:alert(1)' },
    { slug: 'module-a', title: 'Duplicate' }, { title: 'No slug' }, { slug: 'empty-title', title: ' ' },
    { slug: 'module-b', title: 'Module B', category: ' Home ', eyebrow: '02 / HOME', summary: 'Published', detail: 'Details', options: ['Roof'], tone: 'slate', imageUrl: '/uploads/home.jpg' }
  ], faqs: [['Question', 'Answer'], ['Question', 'Duplicate'], ['Invalid', 12], null], settings: { siteName: 12, contactEmail: {}, footerNote: 'Approved footer', internalNotes: 'private' } }, async (loadHomepage, requests) => {
    assert.deepEqual(await loadHomepage(), {
      products: [
        { slug: 'module-a', title: 'Module A', category: '', eyebrow: '', summary: '', detail: '', options: ['Window'], tone: '', imageUrl: '' },
        { slug: 'module-b', title: 'Module B', category: 'Home', eyebrow: '02 / HOME', summary: 'Published', detail: 'Details', options: ['Roof'], tone: 'slate', imageUrl: `http://127.0.0.1:${new URL(process.env.STRAPI_PUBLIC_URL).port}/uploads/home.jpg` }
      ], faqs: [['Question', 'Answer']], settings: { siteName: '', contactEmail: '', footerNote: 'Approved footer' }
    });
    assert.equal(requests[0].url, '/api/homepage');
    assert.equal(requests[0].headers.authorization, undefined);
  });
});

test('localized homepage reads request only the selected published CMS locale', async () => {
  await withCms({ products: [], faqs: [], settings: null }, async (loadHomepage, requests) => {
    await loadHomepage('zh-Hans');
    assert.equal(requests[0].url, '/api/homepage?locale=zh-Hans');
    assert.equal(requests[0].headers.authorization, undefined);
  });
});

test('product-specific FAQ keeps complete localized text and drops malformed rows', async () => {
  await withCms({ products: [{ slug: 'custom-faq', title: 'Custom FAQ', productFaqs: [
    { question: ' Livraison ? ', answer: ' Après confirmation du projet. ', private: 'secret' },
    { question: 'Incomplete', answer: '' }, null, { question: 123, answer: 'invalid' }
  ] }], faqs: [], settings: null }, async loadHomepage => {
    const content = await loadHomepage('fr');
    assert.deepEqual(content.products[0].productFaqs, [{ question: 'Livraison ?', answer: 'Après confirmation du projet.' }]);
  });
});

test('brochure assets use the frontend origin while uploaded CMS media keeps its origin', async () => {
  await withCms({ products: [
    { slug: 'expandable-20ft', title: '20FT', imageUrl: '/products/expandable-20ft.webp' },
    { slug: 'uploaded', title: 'Uploaded', imageUrl: '/uploads/home.jpg' }
  ], faqs: [], settings: null }, async loadHomepage => {
    const result = await loadHomepage('en');
    assert.equal(result.products[0].imageUrl, '/products/expandable-20ft.webp');
    assert.equal(result.products[1].imageUrl, `${process.env.STRAPI_PUBLIC_URL}/uploads/home.jpg`);
  });
});

test('removed capsule models never appear from an older published CMS catalogue', async () => {
  await withCms({ products: ['d5', 'd6', 'd7', 'd9', 'd2', 'd8'].map(model => ({ slug: `space-capsule-${model}`, title: model.toUpperCase() })), faqs: [], settings: null }, async loadHomepage => {
    for (const locale of ['en', 'zh-Hans']) assert.deepEqual((await loadHomepage(locale)).products.map(product => product.slug), ['space-capsule-d7']);
  });
});

test('legacy seeded branding is replaced while custom CMS settings are preserved', async () => {
  for (const siteName of ['Northline Modular', 'NORTHLINE']) {
    await withCms({ products: [], faqs: [], settings: { siteName, contactEmail: 'hello@northlinemodular.example', footerNote: 'Published footer' } }, async loadHomepage => {
      assert.deepEqual((await loadHomepage()).settings, { siteName: 'ZhuDuo', contactEmail: '', footerNote: 'Published footer' });
    });
  }
  const settings = { siteName: 'Custom brand', contactEmail: 'sales@example.org', footerNote: 'Custom footer' };
  await withCms({ products: [], faqs: [], settings }, async loadHomepage => {
    assert.deepEqual((await loadHomepage()).settings, settings);
  });
});

test('invalid CMS envelopes and HTTP failures stay unavailable even in development', async () => {
  for (const body of [null, [], {}, { products: [], faqs: {} }]) {
    await withCms(body, async loadHomepage => { await assert.rejects(loadHomepage()); });
  }
  await withCms({ products: [], faqs: [] }, async loadHomepage => {
    await withEnvironment({ NODE_ENV: 'development' }, () => assert.rejects(loadHomepage()));
  }, 500);
  await withEnvironment({ NODE_ENV: 'development', STRAPI_PUBLIC_URL: 'http://127.0.0.1:1' }, () => assert.rejects(load('lib/content.js').loadHomepage()));
});

test('brochure fallback requires development with no configured CMS URL and includes both languages', async () => {
  await withEnvironment({ NODE_ENV: 'production', STRAPI_PUBLIC_URL: undefined }, () => assert.rejects(load('lib/content.js').loadHomepage()));
  await withEnvironment({ NODE_ENV: 'development', STRAPI_PUBLIC_URL: undefined }, async () => {
    const result = await load('lib/content.js').loadHomepage();
    assert.equal(result.products.length, 113);
    assert.equal(result.products[0].title, '20FT Expandable Container House');
    const chinese = await load('lib/content.js').loadHomepage('zh-Hans');
    assert.equal(chinese.products.length, 113);
    assert.equal(chinese.products[0].title, '20FT 扩展式集装箱房');
    assert.equal(chinese.products[0].imageUrl, '/products/company/expandable-20ft.webp');
  });
});

test('company homepage data normalizes optional fields and excludes incomplete cases and unsafe duplicate documents', async () => {
  await withCms({ products: [{ slug: 'featured', title: 'Featured model', featured: true }], faqs: [], settings: {
    siteName: 'ZHUDUO', contactEmail: 'sales@example.org', footerNote: 'Footer', companyIntro: ' Published intro ', factoryImageUrl: '/uploads/factory.jpg', heroHousingImageUrl: 'javascript:alert(1)',
    foundedYear: 2012, factoryArea: '6500.5', exportMarkets: '24', certificationCount: -1, whatsappNumber: '+44 (1234) 567-890', internalNotes: 'private'
  }, cases: [
    { title: 'Case', location: 'UK', productName: 'House', quantity: '12 units', summary: 'Delivery', imageUrl: '/uploads/case.jpg', publishedAt: '2026-11-03T00:00:00.000Z', internalNotes: 'private' },
    { title: 'Incomplete', location: 'UK', imageUrl: '/uploads/missing.jpg' },
    { title: 'Unsafe', location: 'UK', productName: 'House', quantity: '1', imageUrl: 'data:text/html,unsafe' }
  ], certificates: [
    { title: 'Certificate', url: '/uploads/cert.pdf' }, { title: 'Duplicate', url: '/uploads/cert.pdf' }, { title: 'Unsafe', url: 'javascript:alert(1)' }
  ] }, async loadHomepage => {
    const content = await loadHomepage('fr');
    assert.equal(content.products[0].featured, true);
    assert.deepEqual(content.settings, { siteName: 'ZHUDUO', contactEmail: 'sales@example.org', footerNote: 'Footer', companyIntro: 'Published intro', factoryImageUrl: `${process.env.STRAPI_PUBLIC_URL}/uploads/factory.jpg`, foundedYear: 2012, factoryArea: 6500.5, exportMarkets: 24, whatsappNumber: '441234567890' });
    assert.deepEqual(content.cases, [{ title: 'Case', location: 'UK', productName: 'House', quantity: '12 units', summary: 'Delivery', imageUrl: `${process.env.STRAPI_PUBLIC_URL}/uploads/case.jpg`, publishedAt: '2026-11-03T00:00:00.000Z' }]);
    assert.deepEqual(content.certificates, [{ title: 'Certificate', url: `${process.env.STRAPI_PUBLIC_URL}/uploads/cert.pdf` }]);
    assert.equal(JSON.stringify(content).includes('private'), false);
  });
});
