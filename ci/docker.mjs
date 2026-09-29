import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { useColor } from './output.mjs';

const execute = promisify(execFile);

export function dockerRunArgs({ name, root, options, testing, config, ports, environment = process.env }) {
  const target = testing ? 'e2e' : 'app';
  const headed = testing && (options.headed || environment.HEADED === '1');
  const args = [
    'run', '--rm', '--init', '--name', name, '--stop-timeout', '10',
    '--env', `LOCAL_OUTPUT_COLOR=${useColor(environment) ? '1' : '0'}`,
    '--volume', `${resolve(root, '.local', options.env)}:/app/.local/${options.env}`,
  ];
  if (process.getuid) args.push('--user', `${process.getuid()}:${process.getgid()}`);
  if (testing) {
    args.push('--shm-size', '1g', '--volume', `${resolve(root, 'e2e/reports')}:/app/e2e/reports`);
    if (environment.E2E_VIEWPORT) args.push('--env', `E2E_VIEWPORT=${environment.E2E_VIEWPORT}`);
    if (headed) {
      args.push('--publish', `127.0.0.1:${ports.desktop}:6080`, '--env', 'HEADED=1',
        '--env', `LOCAL_DESKTOP_URL=http://127.0.0.1:${ports.desktop}`);
    }
  } else {
    args.push('--publish', `127.0.0.1:${ports.web}:${config.webPort}`,
      '--publish', `127.0.0.1:${ports.api}:${config.apiPort}`,
      '--env', `LOCAL_PUBLIC_WEB_URL=http://127.0.0.1:${ports.web}`,
      '--env', `LOCAL_PUBLIC_API_URL=http://127.0.0.1:${ports.api}`);
  }
  args.push(`improvement-hub:${target}`, '--env', options.env);
  if (testing && options.tags !== undefined) args.push('--tags', options.tags);
  if (headed) args.push('--headed');
  return args;
}

export async function runDocker({ options, testing, root, processes, config, availablePort }) {
  try {
    await processes.run('docker', ['info', '--format', 'Docker: {{.ServerVersion}}']);
  } catch (error) {
    throw new Error('Docker is unavailable. Install and start Docker Desktop (or Docker Engine), then retry.', { cause: error });
  }
  await mkdir(resolve(root, '.local', options.env), { recursive: true });
  if (testing) await mkdir(resolve(root, 'e2e/reports'), { recursive: true });
  const target = testing ? 'e2e' : 'app';
  await processes.run('docker', ['build', '--target', target, '--tag', `improvement-hub:${target}`, root]);
  const ports = {};
  if (!testing) {
    ports.api = await availablePort(config.apiPort);
    ports.web = await availablePort(config.webPort);
  } else if (options.headed || process.env.HEADED === '1') {
    ports.desktop = await availablePort(6080);
  }
  const name = `improvement-hub-${target}-${randomUUID()}`;
  console.log(`Container: ${name}\nHost database: ${config.database}`);
  try {
    await processes.run('docker', dockerRunArgs({ name, root, options, testing, config, ports }));
  } finally {
    try {
      await execute('docker', ['container', 'inspect', name], { timeout: 5000 });
      await execute('docker', ['stop', '--time', '10', name], { timeout: 20_000 });
    } catch (error) {
      if (!error.stderr?.includes('No such')) {
        console.error(`Could not confirm container cleanup. Check docker ps -a --filter name=${name}`);
        process.exitCode = 1;
      }
    }
  }
}