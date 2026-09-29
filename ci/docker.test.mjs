import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dockerRunArgs } from './docker.mjs';
import { environmentConfig, parseOptions } from './local.mjs';

function runArgs(args, testing = false, environment = {}) {
  const options = parseOptions(args, testing);
  return dockerRunArgs({
    name: 'owned-container', root: '/demo folder', options, testing,
    config: environmentConfig(options.env, '/demo folder'),
    ports: { api: 18000, web: 14200, desktop: 16080 }, environment,
  });
}

test('app container mounts the same selected database and publishes loopback ports', () => {
  for (const environment of ['prod', 'dev']) {
    const args = runArgs(['--docker', '--env', environment]);
    assert.ok(args.includes(`/demo folder/.local/${environment}:/app/.local/${environment}`));
    assert.ok(args.includes(`127.0.0.1:14200:${environment === 'prod' ? 4200 : 4201}`));
    assert.ok(args.includes(`127.0.0.1:18000:${environment === 'prod' ? 8000 : 8001}`));
    assert.deepEqual(args.slice(-3), ['improvement-hub:app', '--env', environment]);
    assert.ok(!args.includes('--docker'));
    assert.ok(args.includes('--rm'));
    assert.ok(args.includes('--init'));
  }
});

test('test container preserves expressions, reports and prod database without exposing API ports', () => {
  const expression = '(@smoke or @validation) and not @api';
  const args = runArgs(['--docker', '--env', 'prod', '--tags', expression], true, {
    E2E_VIEWPORT: 'mobile', DATABASE_URL: 'ignored', LOCAL_PYTHON: 'ignored',
  });
  assert.ok(args.includes('/demo folder/.local/prod:/app/.local/prod'));
  assert.ok(args.includes('/demo folder/e2e/reports:/app/e2e/reports'));
  assert.deepEqual(args.slice(-5), ['improvement-hub:e2e', '--env', 'prod', '--tags', expression]);
  assert.ok(args.includes('E2E_VIEWPORT=mobile'));
  assert.ok(!args.includes('--publish'));
  assert.ok(!args.some((arg) => arg.includes('ignored')));
});

test('headed container publishes only a local browser desktop', () => {
  for (const [args, environment] of [[['--headed'], {}], [[], { HEADED: '1' }]]) {
    const command = runArgs(args, true, environment);
    assert.ok(command.includes('127.0.0.1:16080:6080'));
    assert.ok(command.includes('HEADED=1'));
    assert.ok(command.includes('--headed'));
    assert.equal(command.filter((arg) => arg === '--publish').length, 1);
  }
});

test('both test environments share reports but keep separate databases', () => {
  for (const environment of ['dev', 'prod']) {
    const args = runArgs(['--docker', '--env', environment], true);
    assert.ok(args.includes('/demo folder/e2e/reports:/app/e2e/reports'));
    assert.ok(args.includes(`/demo folder/.local/${environment}:/app/.local/${environment}`));
    assert.ok(!args.some((arg) => arg.includes(`e2e/reports/${environment}`)));
  }
});