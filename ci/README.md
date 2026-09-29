# Local Environment Launcher

This is an ordinary directory. `local.mjs` owns environment selection, Python
setup, SQLite migrations, ports, readiness checks, and child-process cleanup.
`start.mjs` starts the app; `../e2e/run.mjs` uses the same launcher for tests.

```bash
npm start                       # prod
npm start -- --env dev
npm run test:e2e                 # dev
npm run test:e2e -- --env prod
npm run test:e2e -- --env dev --tags "@validation and not @api"
npm run test:e2e -- --headed --tags "@smoke"
npm start -- --docker
npm run test:e2e -- --docker --headed --tags "@smoke"
```

`--tags` is a test-only option forwarded directly to Cucumber. Quote expressions
containing spaces; use `and`, `or`, `not`, and parentheses to combine tags.
Without it, all scenarios run. `npm run test:e2e -- --help` shows the options.
`--headed` opens a visible browser for test runs. Headless is the default;
the existing `HEADED=1` environment setting is still supported.

`--docker` dispatches to `docker.mjs` before host dependency setup. It builds the
`app` or `e2e` target in the root Dockerfile, mounts the selected host database and
test reports, and runs the same launcher inside the image. It does not mount the
source tree or host dependencies. Node alone is enough to invoke these npm scripts;
`npm ci` and host Python/Chromium are not required in this mode.

Reports from both environments share the `e2e/reports/` bind mount. The report
entry page identifies the environment; `npm run test:e2e:report` opens the latest
run without an environment argument. Run tests sequentially, since each invocation
replaces the shared report files. Database mounts remain environment-specific.

In containers, dependencies are already installed and servers bind to all container
interfaces; only explicitly published host loopback ports are accessible from the
host. The wrapper preserves `E2E_VIEWPORT` and `HEADED`, not host Python or database
overrides. Container names are unique per invocation, and cleanup targets only
that name. Existing containers and native servers are left alone.

`output.mjs` formats readiness summaries and labels container server logs. After
health checks succeed, published host URLs appear under `Open on your computer:`;
Angular/Uvicorn addresses above them are labelled as internal. Direct containers
without known host mappings show container-only URLs and refer to `docker run -p`.
Docker test servers with unpublished ports are not advertised as host links.
The host terminal's color preference is forwarded as `LOCAL_OUTPUT_COLOR`, so
the summary stays colored even without allocating a Docker TTY. `NO_COLOR` takes
precedence over `FORCE_COLOR`; captured output defaults to plain text.

`container-display.mjs` starts Xvfb, x11vnc, and noVNC for headed Docker tests.
Use the printed `Browser desktop:` URL while the tests run. Its preferred host
port is 6080, falling back when occupied. This local-only desktop has no password.
See [the root guide](../README.md#docker-fallback) for direct Docker commands and
prebuilt-image distribution without host Node/Python.

Only `prod` and `dev` are valid environment names. Both run locally and persist
their own `.local/<environment>/proposals.db`. Each command
applies Alembic migrations and starts its own API and web server; it never attaches
to or terminates an existing process. Test runs always choose available ports.
App runs prefer 4200/8000 for prod and 4201/8001 for dev, falling back when occupied.

The first run creates `backend/.local-venv` with `PYTHON_BIN` (default `python3`)
and installs `backend/requirements-dev.txt`. Python 3.11+ is required. Dependency
changes trigger another install. `LOCAL_PYTHON` selects an existing interpreter;
`E2E_PYTHON` is accepted as a compatibility alias. Dependencies may be installed
into that selected interpreter, so prefer a virtual environment.

SIGINT/SIGTERM, startup errors, and test completion stop owned processes. Cleanup
waits for exit and escalates to SIGKILL after five seconds. Database files are not
removed. A hard kill or machine crash can bypass cleanup.

`proxy.conf.cjs` strips `/api` and forwards to the API port chosen by the launcher.
`npm run start:web` is frontend-only and defaults to an already running API on 8000;
use `npm start` for normal environment selection.

Validation: `npm run test:local` checks arguments, isolation, port fallback and
process handling. `npm run test:startup` launches both real environments, checks
their APIs, sends SIGINT, and verifies that both ports close while databases remain.
`npm run test:docker` runs that integration check against Docker instead, also
checking container removal and ignoring an intentionally invalid host Python path.
It also occupies preferred ports to verify the published fallback URLs, checks
container log labels, and tests colored and plain readiness output.