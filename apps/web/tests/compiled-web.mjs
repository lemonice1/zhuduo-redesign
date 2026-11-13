import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after } from 'node:test';

const require = createRequire(import.meta.url);
const web = fileURLToPath(new URL('../', import.meta.url));
const output = mkdtempSync(path.join(web, '../../.cache/web-tests-'));
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--target', 'ES2022', '--module', 'commonjs', '--moduleResolution', 'node', '--esModuleInterop', '--resolveJsonModule', '--skipLibCheck', '--outDir', output,
  path.join(web, 'next-env.d.ts'), path.join(web, 'lib/application-content.ts'), path.join(web, 'lib/project-content.ts'), path.join(web, 'lib/project-sample.ts'), path.join(web, 'lib/document-library-content.ts'), path.join(web, 'lib/content.ts'), path.join(web, 'lib/catalogue.ts'), path.join(web, 'lib/site-architecture.ts'), path.join(web, 'lib/inquiry-directions.ts'), path.join(web, 'app/api/inquiries/route.ts'), path.join(web, 'app/api/documents/[group]/[documentId]/route.ts')], { stdio: 'inherit' });
after(() => rmSync(output, { recursive: true, force: true }));

// Next's server-only marker has no runtime logic in the server compiler.
// Compile real source and replace only that marker when running outside Next.
const Module = require('node:module');
export function load(file) {
  for (const id of Object.keys(require.cache)) if (id.startsWith(output)) delete require.cache[id];
  const filename = path.join(output, file);
  const module = new Module(filename);
  module.filename = filename;
  module.paths = Module._nodeModulePaths(path.dirname(filename));
  const nativeRequire = module.require.bind(module);
  module.require = id => id === 'server-only' ? {} : nativeRequire(id);
  const originalLoad = Module._load;
  Module._load = function(id, ...args) { return id === 'server-only' ? {} : originalLoad.call(this, id, ...args); };
  try { module._compile(readFileSync(filename, 'utf8'), filename); }
  finally { Module._load = originalLoad; }
  return module.exports;
}

export async function withEnvironment(values, run) {
  const old = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) value === undefined ? delete process.env[key] : process.env[key] = value;
  try { return await run(); } finally {
    for (const [key, value] of Object.entries(old)) value === undefined ? delete process.env[key] : process.env[key] = value;
  }
}
