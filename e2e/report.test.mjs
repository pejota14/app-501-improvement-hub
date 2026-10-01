import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import ReportIndex from './report-index.mjs';

test('report config shares output paths and identifies the selected environment', async () => {
  const previous = { E2E_ENV: process.env.E2E_ENV, LOCAL_CONTAINER: process.env.LOCAL_CONTAINER };
  try {
    for (const environment of ['dev', 'prod']) {
      for (const container of ['0', '1']) {
        process.env.E2E_ENV = environment;
        process.env.LOCAL_CONTAINER = container;
        const { default: config } = await import(`./cucumber.mjs?env=${environment}&container=${container}`);
        assert.equal(config.worldParameters.environment, environment);
        assert.equal(config.worldParameters.reportDirectory, 'e2e/reports');
        assert.deepEqual(config.formatOptions.report, { environment, runtime: container === '1' ? 'Docker' : 'Native' });
        assert.ok(config.format.includes('pretty'));
        assert.ok(config.format.includes('./e2e/report-index.mjs:e2e/reports/index.html'));
        assert.ok(config.format.includes('html:e2e/reports/cucumber.html'));
        assert.ok(!config.format.some((format) => /reports\/(dev|prod)\//.test(format)));
      }
    }
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('report entry page labels the environment and embeds the standard Cucumber report', () => {
  for (const environment of ['dev', 'prod']) {
    for (const runtime of ['Native', 'Docker']) {
      let html = '';
      new ReportIndex({ parsedArgvOptions: { report: { environment, runtime } }, log: (chunk) => { html += chunk; } });
      assert.ok(html.includes(`<h1>Environment: ${environment}</h1>`));
      assert.ok(html.includes(`<span>${runtime}</span>`));
      assert.ok(html.includes('<iframe src="cucumber.html" title="Cucumber results">'));
    }
  }
  assert.throws(() => new ReportIndex({ parsedArgvOptions: { report: { environment: '<script>', runtime: 'Native' } } }), /Invalid report/);
});

test('report opener has no environment selector and handles a missing report', async () => {
  const execute = promisify(execFile);
  const script = fileURLToPath(new URL('./open-report.mjs', import.meta.url));
  const help = await execute(process.execPath, [script, '--help']);
  assert.match(help.stdout, /latest HTML report/);
  await assert.rejects(execute(process.execPath, [script, '--env', 'prod']), (error) => error.code === 1 && error.stderr.includes('Unknown option'));
  const directory = await mkdtemp(join(tmpdir(), 'report-test-'));
  try {
    const isolated = join(directory, 'open-report.mjs');
    await copyFile(script, isolated);
    await assert.rejects(execute(process.execPath, [isolated]), (error) => error.code === 1 && error.stderr.includes('No report found.'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});