import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

const fixture = {
  SITE_DOMAIN: 'www.fixture.invalid', CMS_DOMAIN: 'cms.fixture.invalid',
  TLS_CERTS_DIR: './tests/fixture-certificates', POSTGRES_DB: 'fixture_db',
  POSTGRES_USER: 'fixture_user', POSTGRES_PASSWORD: 'fixture-db-password',
  APP_KEYS: 'fixture-key-one,fixture-key-two', ADMIN_JWT_SECRET: 'fixture-admin',
  API_TOKEN_SALT: 'fixture-api', TRANSFER_TOKEN_SALT: 'fixture-transfer',
  ENCRYPTION_KEY: 'fixture-encryption', STRAPI_SERVER_TOKEN: 'fixture-server-token',
  S3_ENDPOINT: 'https://storage.fixture.invalid', S3_BUCKET: 'fixture-media',
  S3_ACCESS_KEY: 'fixture-access', S3_SECRET_KEY: 'fixture-secret',
  S3_REGION: 'fixture-region', MEDIA_PUBLIC_URL: 'https://media.fixture.invalid',
  MINIO_ROOT_USER: 'fixture-root', MINIO_ROOT_PASSWORD: 'fixture-root-password',
  MINIO_DATA_DIR: '/srv/fixture/minio-data',
};
function compose(file, changes = {}) {
  const directory = mkdtempSync(resolve(tmpdir(), 'deploy-compose-'));
  try {
    const values = { ...fixture, ...changes };
    const envFile = resolve(directory, 'fixture.env');
    writeFileSync(envFile, Object.entries(values).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}=${v}`).join('\n'));
    const env = { ...process.env };
    for (const key of [...Object.keys(fixture), 'TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY', 'TURNSTILE_EXPECTED_HOSTNAME', 'AUTO_TRANSLATE_ENABLED', 'AUTO_TRANSLATE_API_URL', 'AUTO_TRANSLATE_API_KEY', 'AUTO_TRANSLATE_MODEL', 'AUTO_TRANSLATE_TIMEOUT_MS', 'COMPOSE_FILE', 'COMPOSE_PROJECT_NAME']) delete env[key];
    const binary = process.env.COMPOSE_BIN || (process.platform === 'win32' ? resolve('.cache/tools/docker-compose-v5.6.0.exe') : 'docker');
    const files = Array.isArray(file) ? file : [file];
    const args = [...(binary === 'docker' ? ['compose'] : []), '--env-file', envFile, ...files.flatMap(path => ['-f', path]), 'config', '--format', 'json'];
    const result = spawnSync(binary, args, { env, encoding: 'utf8' });
    assert.ifError(result.error);
    return { ...result, config: result.status === 0 ? JSON.parse(result.stdout) : undefined };
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

test('production exposes only TLS gateway and isolates persistent database', () => {
  const result = compose('docker-compose.yml');
  assert.equal(result.status, 0, result.stderr);
  const { services, networks, volumes } = result.config;
  assert.deepEqual(Object.keys(services).sort(), ['cms', 'nginx', 'postgres', 'web']);
  for (const name of ['cms', 'postgres', 'web']) assert.equal(services[name].ports, undefined);
  assert.deepEqual(services.nginx.ports.map(p => p.target).sort((a, b) => a - b), [80, 443]);
  assert.ok(services.nginx.volumes.some(volume =>
    volume.type === 'bind' &&
    volume.source === resolve('deploy/nginx/conf.d/site.conf') &&
    volume.target === '/etc/nginx/templates/site.conf.template' &&
    volume.read_only === true,
  ));
  assert.equal(networks.database.internal, true);
  assert.deepEqual(Object.keys(services.postgres.networks), ['database']);
  assert.equal(services.postgres.volumes[0].type, 'volume');
  assert.ok(volumes.postgres_production_data);
  assert.equal(services.cms.environment.DATABASE_PASSWORD, 'fixture-db-password');
  assert.equal(services.cms.environment.S3_SECRET_KEY, 'fixture-secret');
  assert.equal(services.cms.environment.SEED_DEMO_CONTENT, 'false');
  assert.equal(services.web.environment.TRUST_PROXY, 'true');
  assert.equal(services.web.environment.S3_SECRET_KEY, undefined);
  for (const name of ['cms', 'web']) {
    assert.equal(services[name].build.context, resolve('.'));
    assert.ok(services[name].healthcheck.test.join(' ').includes('/api/health'));
    assert.ok(!Object.keys(services[name].build.args || {}).some(k => /SECRET|TOKEN|KEY|PASSWORD/.test(k)));
  }
  // Compose config escapes literal dollars for a round-trippable rendered config.
  assert.equal(services.nginx.environment.NGINX_ENVSUBST_FILTER.replaceAll('$$', '$'), '^(SITE_DOMAIN|CMS_DOMAIN)$');
});

test('self-hosted storage keeps root credentials out of apps and uses a private network with loopback API', () => {
  const result = compose(['docker-compose.yml', 'docker-compose.minio.yml']);
  assert.equal(result.status, 0, result.stderr);
  const { services, networks } = result.config;
  assert.equal(networks.storage.internal, true);
  assert.ok(Object.keys(services.minio.networks).includes('storage'));
  assert.deepEqual(Object.keys(services.cms.networks).sort(), ['application', 'database', 'storage']);
  assert.ok(!Object.keys(services.web.networks).includes('storage'));
  assert.equal(services.cms.environment.S3_ENDPOINT, 'http://minio:9000');
  assert.equal(services.cms.environment.S3_FORCE_PATH_STYLE, 'true');
  for (const name of ['cms', 'web']) assert.equal(services[name].environment.MINIO_ROOT_PASSWORD, undefined);
  assert.equal(services.minio.ports.length, 1);
  assert.equal(services.minio.ports[0].host_ip, '127.0.0.1');
  assert.equal(services.minio.ports[0].target, 9000);
  assert.equal(services.minio.environment.MINIO_BROWSER, 'off');
  assert.equal(services.minio.volumes[0].target, '/data');
  assert.equal(services.minio.volumes[0].bind.create_host_path, false);
  assert.equal(services.cms.depends_on['minio-init'].condition, 'service_completed_successfully');
  assert.equal(services.cms.depends_on.postgres.condition, 'service_healthy');
  for (const name of ['minio', 'minio-init']) {
    assert.equal(services[name].read_only, true);
    assert.deepEqual(services[name].cap_drop, ['ALL']);
    assert.ok(!Object.keys(services[name].build.args || {}).some(key => /SECRET|PASSWORD|KEY/.test(key)));
  }
});

test('MinIO can publish its loopback port without joining an application or database network', () => {
  const result = compose(['docker-compose.yml', 'docker-compose.minio.yml']);
  assert.equal(result.status, 0, result.stderr);
  const { services, networks } = result.config;
  // Docker accepts PortBindings on internal-only containers but leaves the
  // runtime mapping null. A non-internal bridge is required for publication.
  const hostNetworks = Object.keys(services.minio.networks).filter(name => !networks[name].internal);
  assert.ok(hostNetworks.length > 0, 'MinIO cannot publish 19000 when all attached networks are internal');
  for (const name of hostNetworks) {
    assert.equal(networks[name].driver, 'bridge');
    assert.deepEqual(Object.entries(services).filter(([, service]) => service.networks?.[name] !== undefined).map(([serviceName]) => serviceName), ['minio']);
  }
  for (const name of ['application', 'database']) assert.ok(!Object.keys(services.minio.networks).includes(name));
  assert.deepEqual(services.minio.ports.map(port => [port.host_ip, port.published, port.target]), [['127.0.0.1', '19000', 9000]]);
});

test('production rejects missing credentials instead of falling back to development secrets', () => {
  for (const key of ['POSTGRES_PASSWORD', 'APP_KEYS', 'ADMIN_JWT_SECRET', 'API_TOKEN_SALT', 'TRANSFER_TOKEN_SALT', 'ENCRYPTION_KEY', 'STRAPI_SERVER_TOKEN', 'S3_SECRET_KEY', 'S3_ACCESS_KEY']) {
    const result = compose('docker-compose.yml', { [key]: undefined });
    assert.notEqual(result.status, 0, `${key} must be required`);
    assert.ok(result.stderr.includes(key), result.stderr);
  }
});

test('self-hosted storage rejects missing root credentials or persistence location', () => {
  for (const key of ['MINIO_ROOT_USER', 'MINIO_ROOT_PASSWORD', 'MINIO_DATA_DIR']) {
    const result = compose(['docker-compose.yml', 'docker-compose.minio.yml'], { [key]: undefined });
    assert.notEqual(result.status, 0, `${key} must be required`);
    assert.ok(result.stderr.includes(key), result.stderr);
  }
});

test('optional Turnstile sends private verification settings only to CMS', () => {
  const result = compose('docker-compose.yml', { TURNSTILE_SITE_KEY: 'public-fixture', TURNSTILE_SECRET_KEY: 'private-fixture', TURNSTILE_EXPECTED_HOSTNAME: 'www.fixture.invalid' });
  assert.equal(result.status, 0, result.stderr);
  const { cms, web } = result.config.services;
  assert.equal(cms.environment.TURNSTILE_SITE_KEY, 'public-fixture');
  assert.equal(web.environment.TURNSTILE_SITE_KEY, 'public-fixture');
  assert.equal(cms.environment.TURNSTILE_SECRET_KEY, 'private-fixture');
  assert.equal(cms.environment.TURNSTILE_EXPECTED_HOSTNAME, 'www.fixture.invalid');
  assert.equal(web.environment.TURNSTILE_SECRET_KEY, undefined);
  assert.equal(web.environment.TURNSTILE_EXPECTED_HOSTNAME, undefined);
  const disabled = compose('docker-compose.yml').config.services;
  assert.equal(disabled.cms.environment.TURNSTILE_SECRET_KEY, '');
  assert.equal(disabled.web.environment.TURNSTILE_SITE_KEY, '');
});

test('direct-port development keeps proxy trust disabled with paired optional captcha injection', () => {
  const result = compose('docker-compose.vm-dev.yml', { TURNSTILE_SITE_KEY: 'public-fixture', TURNSTILE_SECRET_KEY: 'private-fixture', TURNSTILE_EXPECTED_HOSTNAME: 'localhost' });
  assert.equal(result.status, 0, result.stderr);
  const { cms, web } = result.config.services;
  assert.equal(web.environment.TRUST_PROXY, 'false');
  assert.equal(cms.environment.TURNSTILE_SECRET_KEY, 'private-fixture');
  assert.equal(web.environment.TURNSTILE_SITE_KEY, 'public-fixture');
  assert.equal(web.environment.TURNSTILE_SECRET_KEY, undefined);
  assert.equal(compose('docker-compose.dev.yml').status, 0);
});

test('translation defaults off and its provider credentials are injected only into CMS', () => {
  for (const file of ['docker-compose.yml', 'docker-compose.vm-dev.yml']) {
    const defaults = compose(file);
    assert.equal(defaults.status, 0, defaults.stderr);
    assert.equal(defaults.config.services.cms.environment.AUTO_TRANSLATE_ENABLED, 'false');
    const enabled = compose(file, { AUTO_TRANSLATE_ENABLED: 'true', AUTO_TRANSLATE_API_URL: 'https://translator.fixture.invalid/chat/completions', AUTO_TRANSLATE_API_KEY: 'private-translation-fixture', AUTO_TRANSLATE_MODEL: 'fixture-model' });
    assert.equal(enabled.status, 0, enabled.stderr);
    const { cms, web } = enabled.config.services;
    assert.equal(cms.environment.AUTO_TRANSLATE_API_KEY, 'private-translation-fixture');
    assert.equal(cms.environment.AUTO_TRANSLATE_TIMEOUT_MS, '30000');
    for (const name of ['AUTO_TRANSLATE_ENABLED', 'AUTO_TRANSLATE_API_URL', 'AUTO_TRANSLATE_API_KEY', 'AUTO_TRANSLATE_MODEL']) assert.equal(web.environment[name], undefined);
    assert.ok(!JSON.stringify(cms.build?.args ?? {}).includes('private-translation-fixture'));
  }
});
