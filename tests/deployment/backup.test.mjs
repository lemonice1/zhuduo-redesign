import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

// Discover Git Bash on Windows without baking a developer's installation path into tests.
const gitExecPath = process.platform === 'win32' ? spawnSync('git', ['--exec-path'], { encoding: 'utf8' }).stdout?.trim() : undefined;
const shell = process.env.BASH_BIN || (gitExecPath ? resolve(gitExecPath, '../../../bin/bash.exe') : 'bash');
const unixPath = path => process.platform === 'win32' ? path.replaceAll('\\', '/').replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`) : path;
function runBackup(failure = '', running = 'cms\nweb\n', overrides = {}) {
  const dir = mkdtempSync(resolve(tmpdir(), 'deployment-backup-'));
  const bin = resolve(dir, 'bin'); mkdirSync(bin);
  const trace = resolve(dir, 'trace');
  writeFileSync(resolve(bin, 'docker'), `#!/bin/sh
printf 'docker %s\\n' "$*" >> "$TRACE"
case "$*" in
  *'ps --status running --services'*) printf '%s' "$RUNNING" ;;
  *'images --format json'*) [ "$FAILURE" != images ] || exit 37; printf '[{"Repository":"modular-housing-cms","Tag":"fixture-sha","ID":"fixture-image-id"}]' ;;
  *'stop -t 60'*) [ "$FAILURE" != stop ] ;;
  *'exec -T postgres sh -c'*) [ "$FAILURE" != dump ] || exit 31; [ "$FAILURE" != signal ] || kill -TERM "$PPID"; printf 'PGDMP-fixture-binary-data' ;;
  *'start cms'*) [ "$FAILURE" != start ] ;;
  *) exit 90 ;;
esac
`, { mode: 0o755 });
  writeFileSync(resolve(bin, 'rclone'), `#!/bin/sh
printf 'rclone %s\\n' "$*" >> "$TRACE"
case "$1" in
  copy) [ "$FAILURE" != copy ] || exit 32; case "$2" in *snapshots*) [ "$FAILURE" != archive-copy ] || exit 35;; esac ;;
  check) [ "$FAILURE" != check ] || exit 33; case "$2" in *snapshots*) [ "$FAILURE" != archive-check ] || exit 36;; esac ;;
  copyto) [ "$FAILURE" != marker ] || exit 34 ;;
  *) exit 91 ;;
esac
`, { mode: 0o755 });
  writeFileSync(resolve(bin, 'rmdir'), `#!/bin/sh
[ "$FAILURE" != unlock ] || exit 38
exec /usr/bin/rmdir "$@"
`, { mode: 0o755 });
  const env = { ...process.env, STUB_BIN: unixPath(bin), TRACE: unixPath(trace), FAILURE: failure, RUNNING: running,
    BACKUP_LOCAL_DIR: unixPath(resolve(dir, 'snapshots')), BACKUP_SOURCE: 'source:media/prefix',
    BACKUP_TARGET: 'offsite:private-snapshots/site', BACKUP_CONFIRM_WRITES_PAUSED: 'yes',
    BACKUP_RELEASE: 'fixture-git-sha', MEDIA_PUBLIC_URL: 'https://media.fixture.invalid', ...overrides };
  const result = spawnSync(shell, ['-c', 'export PATH="$STUB_BIN:$PATH"; exec bash deploy/backup/backup.sh'], { env, encoding: 'utf8' });
  assert.ifError(result.error);
  const log = existsSync(trace) ? readFileSync(trace, 'utf8') : '';
  const snapshots = existsSync(resolve(dir, 'snapshots')) ? readdirSync(resolve(dir, 'snapshots')) : [];
  const files = snapshots.length ? readdirSync(resolve(dir, 'snapshots', snapshots[0])) : [];
  const manifest = files.includes('manifest.txt') ? readFileSync(resolve(dir, 'snapshots', snapshots[0], 'manifest.txt'), 'utf8') : '';
  rmSync(dir, { recursive: true, force: true });
  return { ...result, log, files, manifest };
}

test('backup produces verified timestamp snapshot and resumes only previously running writers', () => {
  const result = runBackup('', 'cms\n');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /SUCCESS/);
  assert.match(result.log, /stop -t 60 cms\n/);
  assert.match(result.log, /start cms\n/);
  assert.ok(!result.log.includes('start cms web'));
  assert.ok(result.log.indexOf('stop -t 60') < result.log.indexOf('exec -T postgres'));
  assert.ok(result.log.indexOf('exec -T postgres') < result.log.indexOf('rclone copy source:media/prefix'));
  assert.match(result.log, /rclone check source:media\/prefix offsite:private-snapshots\/site\/\d{8}T\d{6}Z-[^ /]+\/media --download/);
  assert.match(result.log, /rclone copyto .*COMPLETE .*COMPLETE/);
  assert.ok(!/\bsync\b|\bdelete\b/.test(result.log));
  assert.ok(result.files.includes('SHA256SUMS'));
  assert.ok(result.files.includes('images.json'));
  assert.match(result.manifest, /release=fixture-git-sha/);
  assert.match(result.manifest, /objects_check=download-verified/);
  assert.ok(!result.manifest.includes('PASSWORD'));
});

for (const stage of ['stop', 'images', 'dump', 'copy', 'check', 'archive-copy', 'archive-check', 'marker', 'start', 'signal', 'unlock']) {
  test(`backup fails closed at ${stage} and restores prior writers`, () => {
    const result = runBackup(stage);
    assert.notEqual(result.status, 0, result.stdout);
    assert.ok(!result.stdout.includes('SUCCESS'));
    assert.match(result.log, /start cms web/);
    if (!['marker', 'start', 'unlock'].includes(stage)) assert.ok(!result.files.includes('COMPLETE'));
  });
}
test('backup refuses same remote and missing consistency acknowledgement before touching services', () => {
  for (const overrides of [{ BACKUP_TARGET: 'source:backups' }, { BACKUP_CONFIRM_WRITES_PAUSED: '' }]) {
    const result = runBackup('', 'cms\nweb\n', overrides);
    assert.notEqual(result.status, 0);
    assert.equal(result.log, '');
    assert.match(result.stderr, /Source and offsite target|Acknowledge maintenance downtime/);
  }
});
test('backup does not start services that were stopped before maintenance', () => {
  const result = runBackup('', '');
  assert.equal(result.status, 0, result.stderr);
  assert.ok(!result.log.includes('stop -t'));
  assert.ok(!result.log.includes('start cms'));
  assert.ok(!result.log.includes('start web'));
});
