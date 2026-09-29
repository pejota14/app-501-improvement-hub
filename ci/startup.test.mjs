import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { promisify, stripVTControlCharacters } from 'node:util';

const docker = process.env.STARTUP_DOCKER === '1';
const execute = promisify(execFile);

for (const environment of ['prod', 'dev']) {
  test(`${docker ? 'container' : 'native'} app initializes ${environment} and stops both servers on SIGINT`, { timeout: docker ? 660_000 : 150_000 }, async (context) => {
    const args = environment === 'prod' ? [] : ['--env', 'dev'];
    if (docker) args.push('--docker');
    const preferredPorts = environment === 'prod' ? [4200, 8000] : [4201, 8001];
    if (docker) {
      for (const port of preferredPorts) {
        const blocker = createServer((socket) => socket.end());
        await new Promise((resolvePort, rejectPort) => {
          blocker.once('error', (error) => error.code === 'EADDRINUSE' ? resolvePort() : rejectPort(error));
          blocker.listen(port, '127.0.0.1', resolvePort);
        });
        if (blocker.listening) context.after(() => new Promise((resolveClose) => blocker.close(resolveClose)));
      }
    }
    const childEnv = { ...process.env, ...(docker ? { LOCAL_PYTHON: '/host-python-not-installed' } : {}) };
    if (environment === 'prod') {
      delete childEnv.NO_COLOR;
      childEnv.FORCE_COLOR = '1';
    } else {
      delete childEnv.FORCE_COLOR;
      childEnv.NO_COLOR = '1';
    }
    const child = spawn(process.execPath, ['ci/start.mjs', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: childEnv,
    });
    let rawOutput = '';
    let output = '';
    let resolveReady;
    let rejectReady;
    const ready = new Promise((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    const collect = (chunk) => {
      rawOutput += chunk;
      output = stripVTControlCharacters(rawOutput);
      if (output.includes('Press Ctrl+C')) resolveReady();
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.once('error', rejectReady);
    const closed = new Promise((resolveClose) => child.once('exit', (code, signal) => {
      rejectReady(new Error(output || `Launcher exited: ${signal || code}`));
      resolveClose({ code, signal });
    }));
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      rejectReady(new Error(`Startup timeout:\n${output}`));
    }, docker ? 600_000 : 120_000);
    let appURL;
    let apiURL;
    try {
      await ready;
      assert.match(output, new RegExp(`Environment: ${environment}`));
      appURL = output.match(/App: (http:\/\/[^\s]+)/)[1];
      apiURL = output.match(/API docs: (http:\/\/[^\s]+)\/docs/)[1];
      assert.match(output, new RegExp(`APP READY \\| ${environment} \\| ${docker ? 'Docker' : 'Native'}`));
      assert.match(output, /Open on your computer:/);
      assert.equal(rawOutput.includes('\u001b[1;32mAPP READY'), environment === 'prod');
      if (docker) {
        assert.notEqual(new URL(appURL).port, String(preferredPorts[0]));
        assert.notEqual(new URL(apiURL).port, String(preferredPorts[1]));
        assert.match(output, /\[container frontend \| internal\].*Local:/);
        assert.match(output, /\[container API \| internal\].*Uvicorn running/);
        const summary = output.slice(output.indexOf('APP READY'));
        assert.doesNotMatch(summary, /http:\/\/(localhost|172\.)/);
        assert.match(summary, /Use the host URLs above/);
      }
      assert.equal((await fetch(`${appURL}/api/health`)).status, 200);
      assert.equal((await fetch(`${apiURL}/health`)).status, 200);
      await access(`.local/${environment}/proposals.db`);
    } finally {
      clearTimeout(timeout);
      child.kill('SIGINT');
      const forcedStop = setTimeout(() => child.kill('SIGKILL'), docker ? 35_000 : 10_000);
      try {
        const result = await closed;
        assert.equal(result.code, 130, output);
      } finally {
        clearTimeout(forcedStop);
      }
    }
    await assert.rejects(fetch(`${appURL}/api/health`, { signal: AbortSignal.timeout(2000) }));
    await assert.rejects(fetch(`${apiURL}/health`, { signal: AbortSignal.timeout(2000) }));
    await access(`.local/${environment}/proposals.db`);
    if (docker) {
      const name = output.match(/Container: (improvement-hub-[^\s]+)/)[1];
      await assert.rejects(execute('docker', ['container', 'inspect', name]), /No such/);
      assert.match(output, /Application shutdown complete/);
    }
  });
}