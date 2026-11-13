import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { load, withEnvironment } from './compiled-web.mjs';

const bytes = Buffer.from('%PDF-1.4\nPublished specification\n%%EOF');
async function fixture(run) {
  const state = { published: true, componentId: 11, filename: 'specification.pdf', filePath: '/uploads/spec.pdf', cmsStatus: 200, fileStatus: 200, requests: [] };
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://cms.invalid');
    state.requests.push(url.pathname + url.search);
    if (url.pathname.startsWith('/api/technical-documents-')) {
      const locale = url.searchParams.get('locale'), group = url.pathname.split('-').at(-1);
      const file = { documentId: 'stablefile123', name: state.filename, url: state.filePath, ext: '.pdf', mime: 'application/pdf', size: 120.5 };
      const data = state.published ? { title: `${group}/${locale}`, summary: 'Library summary', locale, publishedAt: '2026-11-02T00:00:00Z', documents: [
        { id: state.componentId, title: `${group} specification`, description: 'Details', file },
        { id: 11, title: 'Duplicate', file }, { id: 12, title: 'No file' }, { id: 13, title: 'Unsafe', file: { ...file, documentId: 'unsafe', url: 'javascript:alert(1)' } },
        { id: 14, title: '', file }, { id: 15, title: 'Invalid identifier', file: { ...file, documentId: '../private' } }
      ] } : null;
      return response.writeHead(state.cmsStatus, { 'content-type': 'application/json' }).end(JSON.stringify({ data }));
    }
    if (url.pathname === '/uploads/redirect.pdf') return response.writeHead(302, { location: '/must-not-follow' }).end();
    if (url.pathname === '/uploads/spec.pdf') return response.writeHead(state.fileStatus, { 'content-type': 'application/pdf' }).end(bytes);
    response.writeHead(404).end();
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await withEnvironment({ STRAPI_PUBLIC_URL: `http://127.0.0.1:${server.address().port}`, SITE_PREVIEW_MODE: 'false', NODE_ENV: 'production' }, () => run(state));
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
const download = (GET, group = 'housing', documentId = 'stablefile123', language = 'en') => GET(new Request(`http://web.invalid/api/documents/${group}/${documentId}?lang=${language}&url=http://must-not-fetch.invalid/private`), { params: Promise.resolve({ group, documentId }) });

test('separate document libraries normalize only published valid rows for the requested language', async () => {
  await fixture(async state => {
    const { loadDocumentLibrary, loadTechnicalDocuments } = load('lib/document-library-content.js');
    for (const locale of ['en', 'fr', 'ar']) {
      const libraries = await loadTechnicalDocuments(locale);
      assert.deepEqual(libraries.map(item => item.title), [`housing/${locale}`, `electrical/${locale}`]);
      for (const library of libraries) {
        assert.equal(library.documents.length, 1);
        assert.equal(library.documents[0].fileUrl, `${process.env.STRAPI_PUBLIC_URL}/uploads/spec.pdf`);
        assert.equal(library.documents[0].format, 'PDF');
        assert.equal(library.documents[0].sizeKb, 120.5);
      }
    }
    state.published = false;
    assert.deepEqual((await loadDocumentLibrary('housing', 'en')).documents, []);
    await assert.rejects(loadDocumentLibrary('unknown', 'en'));
    await assert.rejects(loadDocumentLibrary('housing', 'all'));
  });
});

test('download endpoint streams the original bytes as an attachment and bypasses the publication cache', async () => {
  await fixture(async state => {
    const { GET } = load('app/api/documents/[group]/[documentId]/route.js');
    const originalFetch = globalThis.fetch, observed = [];
    globalThis.fetch = (url, options) => { observed.push({ url: String(url), options }); return originalFetch(url, options); };
    try {
      const response = await download(GET);
      assert.equal(response.status, 200);
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
      assert.equal(response.headers.get('content-type'), 'application/pdf');
      assert.match(response.headers.get('content-disposition'), /^attachment; filename="specification.pdf"/);
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
      assert.ok(observed.every(call => call.options.cache === 'no-store'));
      assert.ok(observed.every(call => !call.url.includes('must-not-fetch.invalid')));
      assert.equal(observed.at(-1).options.redirect, 'error');
      // Republishing clones Strapi components; cached links must keep working.
      state.componentId = 42;
      const republished = await download(GET);
      assert.equal(republished.status, 200);
      assert.deepEqual(Buffer.from(await republished.arrayBuffer()), bytes);
      state.filename = '房屋资料\r\n.pdf';
      const named = await download(GET);
      assert.equal(named.status, 200);
      assert.match(named.headers.get('content-disposition'), /filename\*=UTF-8''%E6%88%BF/);
      assert.equal(named.headers.get('content-disposition').includes('\r'), false);
      await named.arrayBuffer();
    } finally { globalThis.fetch = originalFetch; }
  });
});

test('drafts, removed entries and invalid category/locale cannot download arbitrary files', async () => {
  await fixture(async state => {
    const { GET } = load('app/api/documents/[group]/[documentId]/route.js');
    for (const [group, id, lang, status] of [['private', '11', 'en', 404], ['housing', '../11', 'en', 404], ['housing', '11', 'all', 400], ['housing', '999', 'en', 404]]) assert.equal((await download(GET, group, id, lang)).status, status);
    assert.ok(state.requests.every(url => url.startsWith('/api/technical-documents-')));
    state.published = false;
    assert.equal((await download(GET)).status, 404);
    assert.equal(state.requests.some(url => url.startsWith('/uploads/')), false);
  });
});

test('missing libraries stay empty and upstream failures stay visible without following media redirects', async () => {
  await fixture(async state => {
    const { GET } = load('app/api/documents/[group]/[documentId]/route.js');
    const { loadDocumentLibrary } = load('lib/document-library-content.js');
    state.cmsStatus = 404;
    assert.equal((await loadDocumentLibrary('housing', 'en')).documents.length, 0);
    state.cmsStatus = 500;
    await assert.rejects(loadDocumentLibrary('housing', 'en'));
    assert.equal((await download(GET)).status, 503);
    state.cmsStatus = 200; state.fileStatus = 404;
    assert.equal((await download(GET)).status, 502);
    state.filePath = '/uploads/redirect.pdf';
    assert.equal((await download(GET)).status, 503);
    assert.equal(state.requests.some(url => url.startsWith('/must-not-follow')), false);
  });
});
