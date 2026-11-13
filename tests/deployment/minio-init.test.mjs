import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const gitPath = process.platform === 'win32' ? spawnSync('git', ['--exec-path'], { encoding: 'utf8' }).stdout?.trim() : undefined;
const shell = process.env.BASH_BIN || (gitPath ? resolve(gitPath, '../../../bin/bash.exe') : 'bash');
const unixPath = path => process.platform === 'win32' ? path.replaceAll('\\', '/').replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`) : path;

function initialize(overrides = {}, failure = '') {
  const directory = mkdtempSync(resolve(tmpdir(), 'minio-init-'));
  const bin = resolve(directory, 'bin'); mkdirSync(bin);
  const trace = resolve(directory, 'trace');
  writeFileSync(resolve(bin, 'mc'), `#!/bin/sh
case "$1 $2" in
  'alias set') printf 'alias\\n' >> "$TRACE" ;;
  'admin policy')
    if [ "$3" = create ]; then cat "$6" >> "$TRACE"; fi
    printf '%s\\n' "$*" >> "$TRACE"
    [ "$FAILURE" != policy ] || exit 29 ;;
  'admin user') printf 'user\\n' >> "$TRACE" ;;
  'anonymous set-json') cat "$3" >> "$TRACE"; [ "$FAILURE" != public ] || exit 28 ;;
  *) printf '%s\\n' "$*" >> "$TRACE" ;;
esac
`, { mode: 0o755 });
  const result = spawnSync(shell, ['-c', 'export PATH="$STUB_BIN:$PATH"; exec sh deploy/minio/init-storage.sh'], {
    encoding: 'utf8', env: { ...process.env, STUB_BIN: unixPath(bin), TRACE: unixPath(trace), FAILURE: failure,
      MINIO_ROOT_USER: 'fixture-root', MINIO_ROOT_PASSWORD: 'fixture-root-secret',
      S3_BUCKET: 'fixture-media', S3_ACCESS_KEY: 'fixture-cms', S3_SECRET_KEY: 'fixture-cms-secret',
      TMPDIR: unixPath(directory), ...overrides },
  });
  assert.ifError(result.error);
  const log = existsSync(trace) ? readFileSync(trace, 'utf8') : '';
  rmSync(directory, { recursive: true, force: true });
  return { ...result, log };
}

test('storage initialization grants only object reads to anonymous visitors and confines CMS to its bucket', () => {
  const result = initialize();
  assert.equal(result.status, 0, result.stderr);
  const policies = [...result.log.matchAll(/\{\s*"Version"[\s\S]*?\n\}/g)].map(match => JSON.parse(match[0]));
  const publicPolicy = policies.find(policy => policy.Statement.some(item => item.Principal));
  assert.ok(publicPolicy, result.log);
  assert.deepEqual(publicPolicy.Statement.flatMap(item => item.Action), ['s3:GetObject']);
  assert.deepEqual(publicPolicy.Statement.flatMap(item => item.Resource), ['arn:aws:s3:::fixture-media/*']);
  const cmsPolicy = policies.find(policy => !policy.Statement.some(item => item.Principal));
  assert.ok(cmsPolicy);
  assert.ok(cmsPolicy.Statement.every(item => item.Resource.every(resource => /^arn:aws:s3:::fixture-media(?:\/\*)?$/.test(resource))));
  assert.ok(!JSON.stringify(cmsPolicy).includes('admin:'));
  assert.ok(!JSON.stringify(cmsPolicy).includes('s3:*'));
  assert.ok(!result.stdout.includes('fixture-cms-secret'));
  assert.match(result.stdout, /initialized/);
  assert.match(result.log, /policy attach .* --user fixture-cms/);
});

test('invalid bucket and shared root credentials are rejected before contacting storage', () => {
  for (const overrides of [{ S3_BUCKET: 'bad"bucket' }, { S3_BUCKET: '' }, { S3_ACCESS_KEY: 'fixture-root' }, { S3_SECRET_KEY: 'fixture-root-secret' }]) {
    const result = initialize(overrides);
    assert.notEqual(result.status, 0);
    assert.equal(result.log, '');
    assert.match(result.stderr, /S3_BUCKET|Invalid media bucket|CMS credentials/);
  }
});

for (const failure of ['policy', 'public']) {
  test(`initialization fails without claiming success when ${failure} provisioning fails`, () => {
    const result = initialize({}, failure);
    assert.equal(result.status, failure === 'policy' ? 29 : 28, result.stderr);
    assert.ok(!result.stdout.includes('initialized'));
  });
}
