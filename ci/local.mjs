import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createConnection, createServer } from 'node:net';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { containerLogLine, readyMessage } from './output.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

export function parseOptions(args, testing = false) {
  const { values } = parseArgs({
    args,
    options: {
      env: { type: 'string', default: testing ? 'dev' : 'prod' },
      help: { type: 'boolean' },
      docker: { type: 'boolean' },
      ...(testing ? { tags: { type: 'string' }, headed: { type: 'boolean' } } : {}),
    },
  });
  if (!['prod', 'dev'].includes(values.env)) {
    throw new Error('--env must be prod or dev');
  }
  return values;
}

export function environmentConfig(environment, directory = root) {
  if (!['prod', 'dev'].includes(environment)) throw new Error('Unknown local environment');
  const database = resolve(directory, '.local', environment, 'proposals.db');
  return {
    database,
    databaseURL: `sqlite+pysqlite:///${database}`,
    apiPort: environment === 'prod' ? 8000 : 8001,
    webPort: environment === 'prod' ? 4200 : 4201,
  };
}

export class Processes {
  jobs = [];
  controller = new AbortController();

  start(command, args, env = process.env, containerService) {
    this.controller.signal.throwIfAborted();
    const child = spawn(command, args, {
      cwd: root, env, stdio: containerService ? ['inherit', 'pipe', 'pipe'] : 'inherit', detached: true,
    });
    if (containerService) {
      for (const [input, output] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
        createInterface({ input, crlfDelay: Infinity }).on('line', (line) => {
          output.write(containerLogLine(containerService, line));
        });
      }
    }
    const job = { child, ended: false, sentSignals: new Set() };
    job.done = new Promise((resolveExit) => {
      child.once('error', (error) => resolveExit({ error }));
      child.once('exit', (code, signal) => resolveExit({ code, signal }));
    }).then((result) => {
      job.ended = true;
      return result;
    });
    this.jobs.push(job);
    return job;
  }

  async run(command, args, env) {
    const job = this.start(command, args, env);
    let onAbort;
    const interrupted = new Promise((resolveInterrupted, rejectInterrupted) => {
      onAbort = () => rejectInterrupted(this.controller.signal.reason);
      this.controller.signal.addEventListener('abort', onAbort, { once: true });
    });
    try {
      const result = await Promise.race([job.done, interrupted]);
      if (result.error) throw result.error;
      if (result.code !== 0) throw new Error(`${command} exited with ${result.signal || result.code}`);
    } finally {
      this.controller.signal.removeEventListener('abort', onAbort);
    }
  }

  signal(job, signal) {
    if (!job.child.pid || job.ended || job.sentSignals.has(signal)) return;
    try {
      process.kill(-job.child.pid, signal);
      job.sentSignals.add(signal);
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }

  interrupt() {
    this.controller.abort(new Error('Run interrupted'));
    for (const job of this.jobs) this.signal(job, 'SIGTERM');
  }

  async stop() {
    await Promise.all(this.jobs.map(async (job) => {
      this.signal(job, 'SIGTERM');
      const timeout = setTimeout(() => this.signal(job, 'SIGKILL'), 5000);
      try {
        await job.done;
      } finally {
        clearTimeout(timeout);
      }
    }));
  }
}

export async function availablePort(preferred) {
  if (preferred !== 0) {
    const occupied = await new Promise((resolveOccupied) => {
      const socket = createConnection({ host: '127.0.0.1', port: preferred });
      const finish = (value) => {
        socket.destroy();
        resolveOccupied(value);
      };
      socket.once('connect', () => finish(true));
      socket.once('error', () => finish(false));
      socket.setTimeout(1000, () => finish(true));
    });
    if (occupied) return availablePort(0);
  }
  const server = createServer();
  return new Promise((resolvePort, rejectPort) => {
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE' && preferred !== 0) {
        availablePort(0).then(resolvePort, rejectPort);
      } else rejectPort(error);
    });
    server.listen(preferred, '127.0.0.1', () => {
      const { port } = server.address();
      server.close((error) => error ? rejectPort(error) : resolvePort(port));
    });
  });
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return false;
  }
}

async function preparePython(processes) {
  const override = process.env.LOCAL_PYTHON || process.env.E2E_PYTHON;
  const python = override || resolve(root, 'backend/.local-venv/bin/python');
  if (process.env.LOCAL_CONTAINER === '1') {
    await access(python);
    return python;
  }
  const createEnvironment = !override && !await exists(python);
  if (createEnvironment) {
    await processes.run(process.env.PYTHON_BIN || 'python3', ['-m', 'venv', 'backend/.local-venv']);
  }
  await processes.run(python, ['-c', 'import sys; assert sys.version_info >= (3, 11), "Python 3.11+ is required"']);
  const requirements = await readFile(resolve(root, 'backend/requirements-dev.txt'));
  const runtimeRequirements = await readFile(resolve(root, 'backend/requirements.txt'));
  const fingerprint = createHash('sha256').update(python).update(requirements).update(runtimeRequirements).digest('hex');
  const marker = resolve(root, '.local/python-requirements.sha256');
  if (createEnvironment || !await exists(marker) || (await readFile(marker, 'utf8')) !== fingerprint) {
    await processes.run(python, ['-m', 'pip', 'install', '--disable-pip-version-check', '-r', 'backend/requirements-dev.txt']);
    await writeFile(marker, fingerprint);
  }
  return python;
}

async function waitForHealth(url, servers, processes) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    processes.controller.signal.throwIfAborted();
    if (servers.some((job) => job.ended)) throw new Error('A server stopped during startup');
    try {
      const response = await fetch(url, {
        signal: AbortSignal.any([processes.controller.signal, AbortSignal.timeout(2000)]),
      });
      if (response.ok && (await response.json()).status === 'ok') return;
    } catch {
      processes.controller.signal.throwIfAborted();
    }
    await delay(200, undefined, { signal: processes.controller.signal });
  }
  throw new Error(`Server did not become ready: ${url}`);
}

export async function runLocal({ testing = false, args = process.argv.slice(2) } = {}) {
  const processes = new Processes();
  const interrupt = () => processes.interrupt();
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  try {
    const options = parseOptions(args, testing);
    if (options.help) {
      console.log(`Usage: npm ${testing ? 'run test:e2e' : 'start'} -- [--env prod|dev] [--docker]${testing ? ' [--tags "expression"] [--headed]' : ''}`);
      console.log(`Default: ${testing ? 'dev' : 'prod'}. Both are local SQLite environments.`);
      if (testing) console.log('Example: npm run test:e2e -- --tags "@validation and not @api"');
      return;
    }
    const config = environmentConfig(options.env);
    if (options.docker) {
      if (process.env.LOCAL_CONTAINER === '1') throw new Error('Do not pass --docker inside a container.');
      const { runDocker } = await import('./docker.mjs');
      await runDocker({ options, testing, root, processes, config, availablePort });
      return;
    }
    const container = process.env.LOCAL_CONTAINER === '1';
    const bindHost = container ? '0.0.0.0' : '127.0.0.1';
    await mkdir(resolve(root, '.local', options.env), { recursive: true });
    const python = await preparePython(processes);
    const [apiPort, webPort] = await Promise.all([
      availablePort(testing ? 0 : config.apiPort),
      availablePort(testing ? 0 : config.webPort),
    ]);
    const env = {
      ...process.env,
      APP_ENV: options.env,
      DATABASE_URL: config.databaseURL,
      LOCAL_API_URL: `http://127.0.0.1:${apiPort}`,
      E2E_ENV: options.env,
      E2E_BASE_URL: `http://127.0.0.1:${webPort}`,
      ...(testing && options.headed ? { HEADED: '1' } : {}),
    };
    console.log(`Environment: ${options.env}\nDatabase: ${config.database}`);
    if (testing && options.env === 'prod') console.log('Tests will add synthetic proposals to the local app database.');
    const displayJobs = [];
    if (container && testing && env.HEADED === '1') {
      const { startDisplay } = await import('./container-display.mjs');
      env.DISPLAY = ':99';
      displayJobs.push(...await startDisplay(processes, env));
      console.log(`Browser desktop: ${process.env.LOCAL_DESKTOP_URL || 'http://127.0.0.1:6080'}/vnc.html?autoconnect=true&resize=scale`);
    }
    await processes.run(python, ['-m', 'alembic', '-c', 'backend/alembic.ini', 'upgrade', 'head'], env);
    const api = processes.start(python, [
      '-m', 'uvicorn', 'backend.app:app', '--host', bindHost, '--port', String(apiPort),
    ], env, container ? 'API' : undefined);
    await waitForHealth(`${env.LOCAL_API_URL}/health`, [api, ...displayJobs], processes);
    const web = processes.start(process.execPath, [
      resolve(root, 'node_modules/@angular/cli/bin/ng.js'), 'serve',
      '--host', bindHost, '--port', String(webPort), '--proxy-config', 'ci/proxy.conf.cjs',
    ], env, container ? 'frontend' : undefined);
    await waitForHealth(`${env.E2E_BASE_URL}/api/health`, [api, web, ...displayJobs], processes);
    console.log(readyMessage({
      environment: options.env, container, testing,
      webURL: env.E2E_BASE_URL, apiURL: env.LOCAL_API_URL,
      publicWebURL: process.env.LOCAL_PUBLIC_WEB_URL,
      publicApiURL: process.env.LOCAL_PUBLIC_API_URL,
    }));
    const stopped = Promise.race([api.done, web.done, ...displayJobs.map((job) => job.done)]).then(() => {
      throw new Error('A local server stopped');
    });
    if (testing) {
      await Promise.race([stopped, processes.run(process.execPath, [
        resolve(root, 'node_modules/@cucumber/cucumber/bin/cucumber.js'), '--config', 'e2e/cucumber.mjs',
        ...(options.tags === undefined ? [] : ['--tags', options.tags]),
      ], env)]);
    } else {
      console.log('Press Ctrl+C to stop the frontend and backend. Database contents are retained.');
      await stopped;
    }
  } catch (error) {
    if (!processes.controller.signal.aborted) console.error(error.message);
    process.exitCode = processes.controller.signal.aborted ? 130 : 1;
  } finally {
    await processes.stop();
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
    if (processes.jobs.length) console.log('Frontend/backend stopped. Local database retained.');
  }
}