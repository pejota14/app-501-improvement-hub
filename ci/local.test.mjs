import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { availablePort, environmentConfig, parseOptions, Processes } from './local.mjs';
import { containerLogLine, readyMessage, useColor } from './output.mjs';

test('Docker readiness highlights only published host URLs', () => {
  const message = readyMessage({
    environment: 'prod', container: true,
    webURL: 'http://127.0.0.1:4200', apiURL: 'http://127.0.0.1:8000',
    publicWebURL: 'http://127.0.0.1:62796', publicApiURL: 'http://127.0.0.1:62794',
  }, false);
  assert.match(message, /APP READY \| prod \| Docker/);
  assert.match(message, /Open on your computer:/);
  assert.match(message, /App: http:\/\/127.0.0.1:62796/);
  assert.match(message, /API docs: http:\/\/127.0.0.1:62794\/docs/);
  assert.doesNotMatch(message, /:4200|:8000|\u001b/);
});

test('unpublished container addresses are never advertised as host links', () => {
  for (const testing of [false, true]) {
    const message = readyMessage({
      environment: 'dev', container: true, testing,
      webURL: 'http://127.0.0.1:4201', apiURL: 'http://127.0.0.1:8001',
    }, false);
    assert.match(message, /Container-only addresses \(not host URLs\)/);
    assert.doesNotMatch(message, /Open on your computer|  App:/);
    assert.match(message, testing ? /ports are not published/ : /docker run -p/);
  }
});

test('native readiness uses local URLs and optional colors', () => {
  const options = { environment: 'dev', container: false, webURL: 'http://127.0.0.1:4201', apiURL: 'http://127.0.0.1:8001' };
  const plain = readyMessage(options, false);
  assert.match(plain, /APP READY \| dev \| Native/);
  assert.match(plain, /App: http:\/\/127.0.0.1:4201/);
  assert.match(readyMessage(options, true), /\u001b\[1;36m/);
  assert.equal(useColor({}, false), false);
  assert.equal(useColor({}, true), true);
  assert.equal(useColor({ TERM: 'dumb' }, true), false);
  assert.equal(useColor({ LOCAL_OUTPUT_COLOR: '1' }, false), true);
  assert.equal(useColor({ FORCE_COLOR: '0', LOCAL_OUTPUT_COLOR: '1' }, true), false);
  assert.equal(useColor({ FORCE_COLOR: '1' }, false), true);
  assert.equal(useColor({ NO_COLOR: '', FORCE_COLOR: '1' }, true), false);
});

test('container log labels preserve server messages and URLs', () => {
  assert.equal(containerLogLine('frontend', 'Local: http://localhost:4200/', false),
    '[container frontend | internal] Local: http://localhost:4200/\n');
  assert.equal(containerLogLine('API', 'ERROR: address already in use', false),
    '[container API | internal] ERROR: address already in use\n');
});

test('app defaults to prod and tests default to dev', () => {
  assert.equal(parseOptions([]).env, 'prod');
  assert.equal(parseOptions([], true).env, 'dev');
});

test('both entry points accept either environment', () => {
  for (const testing of [false, true]) {
    for (const environment of ['prod', 'dev']) {
      assert.equal(parseOptions(['--env', environment], testing).env, environment);
    }
  }
});

test('test tag expressions are preserved alongside environment selection', () => {
  const expression = '(@smoke or @validation) and not @api';
  const options = parseOptions(['--env', 'prod', '--tags', expression], true);
  assert.equal(options.env, 'prod');
  assert.equal(options.tags, expression);
  assert.equal(parseOptions(['--tags=@smoke'], true).tags, '@smoke');
  assert.equal(parseOptions([], true).tags, undefined);
});

test('tags require a value and are only accepted for tests', () => {
  assert.throws(() => parseOptions(['--tags'], true));
  assert.throws(() => parseOptions(['--tags', '@smoke']));
});

test('headed is an optional test-only flag that combines with tags and environment', () => {
  assert.equal(parseOptions([], true).headed, undefined);
  assert.equal(parseOptions(['--headed'], true).headed, true);
  const options = parseOptions(['--headed', '--env', 'prod', '--tags', '@smoke'], true);
  assert.equal(options.headed, true);
  assert.equal(options.env, 'prod');
  assert.equal(options.tags, '@smoke');
  assert.throws(() => parseOptions(['--headed']));
  assert.throws(() => parseOptions(['--headed=false'], true));
});

test('invalid arguments cannot silently select another database', () => {
  for (const args of [['--env', 'test'], ['--env'], ['--unknown'], ['prod']]) {
    assert.throws(() => parseOptions(args));
  }
});

test('docker is optional for both launchers and preserves test options', () => {
  for (const testing of [false, true]) {
    assert.equal(parseOptions([], testing).docker, undefined);
    assert.equal(parseOptions(['--docker'], testing).docker, true);
    assert.throws(() => parseOptions(['--docker=false'], testing));
  }
  const options = parseOptions(['--docker', '--env', 'prod', '--headed', '--tags', '@smoke and not @api'], true);
  assert.equal(options.env, 'prod');
  assert.equal(options.headed, true);
  assert.equal(options.tags, '@smoke and not @api');
});

test('database mapping is persistent and separates prod from dev', () => {
  const prod = environmentConfig('prod');
  const dev = environmentConfig('dev');
  assert.deepEqual(prod, environmentConfig('prod'));
  assert.notEqual(prod.databaseURL, dev.databaseURL);
  assert.match(prod.databaseURL, /\/\.local\/prod\/proposals\.db$/);
  assert.match(dev.databaseURL, /\/\.local\/dev\/proposals\.db$/);
  assert.throws(() => environmentConfig('../prod'));
});

test('occupied preferred ports fall back without stopping the existing listener', async () => {
  const server = createServer((socket) => socket.end());
  server.listen(0, '0.0.0.0');
  await once(server, 'listening');
  try {
    const { port } = server.address();
    assert.notEqual(await availablePort(port), port);
    assert.equal(server.listening, true);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test('cleanup stops only children owned by the launcher', async () => {
  const processes = new Processes();
  const job = processes.start(process.execPath, ['-e', 'setInterval(() => {}, 1000)']);
  await once(job.child, 'spawn');
  await processes.stop();
  assert.equal(job.ended, true);
  assert.throws(() => process.kill(job.child.pid, 0), { code: 'ESRCH' });
});

test('interrupt stops children and prevents more startup work', async () => {
  const processes = new Processes();
  const job = processes.start(process.execPath, ['-e', 'setInterval(() => {}, 1000)']);
  await once(job.child, 'spawn');
  processes.interrupt();
  await processes.stop();
  assert.equal(job.ended, true);
  assert.throws(() => processes.start(process.execPath, ['-v']), /interrupted/);
});

test('failed commands and missing executables report failure', async () => {
  const processes = new Processes();
  try {
    await assert.rejects(processes.run(process.execPath, ['-e', 'process.exit(2)']), /exited with 2/);
    await assert.rejects(processes.run('/missing-demo-python', []), { code: 'ENOENT' });
  } finally {
    await processes.stop();
  }
});

test('interrupt releases a running command so cleanup can finish', async () => {
  const processes = new Processes();
  const running = processes.run(process.execPath, ['-e', 'setInterval(() => {}, 1000)']);
  const rejected = assert.rejects(running, /interrupted/);
  await once(processes.jobs[0].child, 'spawn');
  processes.interrupt();
  await rejected;
  await processes.stop();
  assert.equal(processes.jobs[0].ended, true);
});