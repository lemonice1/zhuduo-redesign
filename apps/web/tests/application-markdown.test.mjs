import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const output = mkdtempSync(path.resolve('.cache/application-markdown-'));
after(() => rmSync(output, { recursive: true, force: true }));
const source = readFileSync(new URL('../components/site/application-article.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const filename = path.join(output, 'article.mjs');
writeFileSync(filename, compiled);
const { default: Article } = await import(pathToFileURL(filename).href);
const content = { title: 'Page', summary: '', coverImageUrl: '/cover.jpg', coverImageAlt: 'Cover', mediaBaseUrl: 'https://cms.example.org/' };
const render = (body, language = 'en') => renderToStaticMarkup(createElement(Article, { content: { ...content, body }, language }));

test('real Markdown renderer supports headings, emphasis, lists, links and CMS upload images', () => {
  const html = render('## Benefits\n\n**Strong** and *flexible*.\n\n- First\n- Second\n\n1. Design\n2. Deliver\n\n[Contact](/contact?lang=en)\n\n![Factory](/uploads/factory.jpg)');
  for (const expected of ['<h2>Benefits</h2>', '<strong>Strong</strong>', '<em>flexible</em>', '<ul>', '<ol>', '<li>Deliver</li>', 'href="/contact?lang=en"', 'src="https://cms.example.org/uploads/factory.jpg"', 'alt="Factory"', 'loading="lazy"']) assert.ok(html.includes(expected), expected);
});

test('Markdown never executes embedded HTML, event handlers or script URLs', () => {
  const html = render('<script>alert(1)</script>\n\n<img src=x onerror=alert(2)>\n\n[Bad](javascript:alert%281%29)\n\n![Bad](data:image/svg+xml;base64,PHN2Zz4=)');
  for (const unsafe of ['<script', 'onerror', 'javascript:', 'data:image', 'src=""']) assert.equal(html.includes(unsafe), false, unsafe);
});

test('Arabic direction applies only to the article and images fit the same layout', () => {
  const html = render('## التطبيقات\n\nنص عربي', 'ar');
  assert.ok(html.includes('lang="ar" dir="rtl"'));
  assert.ok(html.includes('class="hp-application-cover"'));
  assert.ok(render('English').includes('lang="en" dir="ltr"'));
});
