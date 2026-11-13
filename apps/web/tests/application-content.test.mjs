import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { load, withEnvironment } from './compiled-web.mjs';

const slugs = ['energy-utilities', 'industrial-projects', 'residential-hospitality', 'commercial-temporary-buildings'];
const published = (locale = 'en') => ({ title: 'Published application', summary: 'Summary', body: '## Heading\n\n**Content**', locale, publishedAt: '2026-11-02T00:00:00Z', coverImage: { url: '/uploads/cover.jpg', alternativeText: 'Cover' } });

async function withCms(body, run, status = 200) {
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push(request);
    const value = typeof body === 'function' ? body(new URL(request.url, 'http://cms.invalid')) : body;
    response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(value));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await withEnvironment({ NODE_ENV: 'production', SITE_PREVIEW_MODE: 'false', STRAPI_PUBLIC_URL: `http://127.0.0.1:${server.address().port}`, STRAPI_SERVER_TOKEN: 'test-private-token' }, () => run(load('lib/application-content.js').loadApplicationContent, requests));
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}

test('each application and language reads its own published Single Type without admin credentials', async () => {
  await withCms(url => ({ data: { ...published(url.searchParams.get('locale')), title: url.pathname } }), async (read, requests) => {
    for (const slug of slugs) for (const locale of ['en', 'fr', 'ar']) {
      const result = await read(slug, locale);
      assert.equal(result.title, `/api/application-${slug}`);
      assert.equal(result.body, '## Heading\n\n**Content**');
      assert.equal(result.coverImageUrl, `${process.env.STRAPI_PUBLIC_URL}/uploads/cover.jpg`);
      assert.equal(result.coverImageAlt, 'Cover');
      assert.equal(requests.at(-1).url, `/api/application-${slug}?locale=${locale}`);
      assert.equal(requests.at(-1).headers.authorization, undefined);
    }
    assert.equal(await read('constructor', 'en'), null);
    assert.equal(await read('../site-setting', 'en'), null);
    assert.equal(requests.length, 12);
  });
});

test('unpublished, incomplete or wrong-language content preserves the existing application page', async () => {
  for (const data of [null, { ...published(), publishedAt: null }, published('fr'), { ...published(), title: '' }, { ...published(), body: ' ' }]) {
    await withCms({ data }, async read => assert.equal(await read(slugs[0], 'en'), null));
  }
  await withCms({}, async read => assert.equal(await read(slugs[0], 'en'), null), 404);
});

test('invalid optional media is ignored, but real CMS failures and invalid envelopes remain visible', async () => {
  await withCms({ data: { ...published(), coverImage: { url: 'javascript:alert(1)' } } }, async read => {
    const result = await read(slugs[0], 'en');
    assert.equal(result.coverImageUrl, '');
    assert.equal(result.coverImageAlt, result.title);
  });
  for (const envelope of [null, {}, { data: [] }]) await withCms(envelope, async read => assert.rejects(read(slugs[0], 'en')));
  await withCms({}, async read => assert.rejects(read(slugs[0], 'en')), 500);
  await withCms({ data: published() }, async (read, requests) => {
    await assert.rejects(read(slugs[0], 'all'));
    assert.equal(requests.length, 0);
  });
});

test('explicit local preview and unconfigured development preserve existing pages without fetching', async () => {
  await withEnvironment({ NODE_ENV: 'development', STRAPI_PUBLIC_URL: undefined, SITE_PREVIEW_MODE: 'false' }, async () => {
    const read = load('lib/application-content.js').loadApplicationContent;
    assert.equal(await read(slugs[0], 'en'), null);
    await withEnvironment({ NODE_ENV: 'production' }, () => assert.rejects(read(slugs[0], 'en')));
    await withEnvironment({ SITE_PREVIEW_MODE: 'true' }, async () => assert.equal(await read(slugs[0], 'en'), null));
  });
});
