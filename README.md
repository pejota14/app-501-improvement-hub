# Improvement Hub QA Demo

A web-only Angular form backed by FastAPI and SQLAlchemy. The root URL opens the
proposal form; unknown routes return there. Native apps, advertising, store
publishing, the landing page, and privacy-policy pages are not part of this demo.

## Setup

Use Node.js 22.15+ (22.x), Python 3.11+, and macOS or Linux.
For an alternative to installing dependencies on your machine, see
[Docker fallback](#docker-fallback). Native commands remain unchanged.

```bash
npm ci
npm run e2e:install
```

## Run the demo

One command initializes the selected SQLite database and starts the backend and
frontend.

```bash
npm start
npm start -- --env dev
```

App startup defaults to `prod`. These are local demo names, not deployment tiers:

| Environment | Database | Preferred Web / API Ports |
| --- | --- | --- |
| `prod` | `.local/prod/proposals.db` | 4200 / 8000 |
| `dev` | `.local/dev/proposals.db` | 4201 / 8001 |

Open the `App:` URL under `APP READY` / `Open on your computer:`. Occupied ports are replaced with
available ports; existing servers are never stopped or reused. `/api/*` is proxied
to the backend started by that invocation. API docs are available in both environments.

The launcher creates `backend/.local-venv` when missing and installs backend
requirements on first use or when they change. First-time setup requires network
access. Set `PYTHON_BIN=python3.11` to select the Python used to create the venv,
or `LOCAL_PYTHON` to use an existing interpreter. Alembic runs on every startup;
existing database contents are preserved.

Ctrl+C stops both frontend and backend. Startup failures and test failures also
stop processes started by that command. Databases remain for the next run. English
is the fallback language; Spanish form translations have not yet been supplied.

## Docker fallback

With Node.js and a running local Docker Desktop or Docker Engine:

```bash
npm start -- --docker
npm start -- --docker --env dev
npm run test:e2e -- --docker
npm run test:e2e -- --docker --env prod --tags "@smoke"
npm run test:e2e -- --docker --headed --tags "@smoke or @resilience"
```

These commands do not require `npm ci`, host Python, or host browser installation.
The launcher builds the selected image, using cached layers when possible, and
runs the existing startup/test flow inside it. The first build requires internet
access. The app image contains the frontend, API, and SQLite support; the separate
test image also contains Chromium and its system dependencies.

Defaults stay the same: app `prod`, tests `dev`. Bind mounts keep the same
`.local/<environment>/proposals.db` and shared `e2e/reports/` files as native
runs. Ctrl+C stops the owned container; test containers stop on completion or
failure. Data and reports remain. Published ports bind to localhost and fall back
to available ports when occupied. The images use the same development servers,
not a production deployment setup.

Docker server logs are prefixed with `[container frontend | internal]` or
`[container API | internal]`. Addresses in those logs belong to the container;
use the final `Open on your computer:` URLs, which include the published host
ports. The ready heading is green and host links are cyan in interactive terminals.
Set `NO_COLOR=1` for plain output or `FORCE_COLOR=1` to force color. Captured logs
are plain by default. Test containers without published web/API ports explicitly
label their addresses as container-only.

With `--docker --headed`, open the printed `Browser desktop:` URL to watch Chromium
through noVNC. It does not open a native macOS/Linux browser window. The desktop
exists only while tests run, and tests do not pause for you to connect. Headless
remains the default. Keep the desktop local; it has no authentication.

### Without host Node or Python

From the repository, build the images using only Docker:

```bash
docker build --target app -t improvement-hub:app .
docker build --target e2e -t improvement-hub:e2e .
```

Then run the app (default `prod`):

```bash
mkdir -p .local/prod
docker run --rm --init --name improvement-hub-app \
	--user "$(id -u):$(id -g)" \
	-p 127.0.0.1:4200:4200 -p 127.0.0.1:8000:8000 \
	--mount "type=bind,source=$PWD/.local/prod,target=/app/.local/prod" \
	improvement-hub:app
```

Open `http://127.0.0.1:4200/`; API docs are at `http://127.0.0.1:8000/docs`.
Ctrl+C stops it. Direct `docker run` uses exactly the specified ports: if occupied,
change the host port (for example, `127.0.0.1:4300:4200`) and open that port instead.
For `dev`, mount `.local/dev`, publish 4201 and 8001, and append `--env dev` after
the image name.

Run tests (default `dev`):

```bash
mkdir -p .local/dev e2e/reports
docker run --rm --init --shm-size=1g \
	--user "$(id -u):$(id -g)" \
	--mount "type=bind,source=$PWD/.local/dev,target=/app/.local/dev" \
	--mount "type=bind,source=$PWD/e2e/reports,target=/app/e2e/reports" \
	improvement-hub:e2e --tags "@smoke"
```

Omit `--tags` for the full suite. For `prod`, change only the database mount to `prod` and
append `--env prod`. For headed tests, add `-p 127.0.0.1:6080:6080` before the image
name and `--headed` after it. To run mobile-width tests, add `-e E2E_VIEWPORT=mobile`
before the image name. Keep the mounts: without them, removing a container also
removes its data/reports. The user flag keeps generated files owned by your user
on Linux; these shell examples work on macOS and Linux.

### Distributing prebuilt images

To avoid installation or image-build downloads on the recipient's machine, build
once and export the images:

```bash
docker image save -o improvement-hub-images.tar improvement-hub:app improvement-hub:e2e
```

The recipient needs only Docker and an image built for their CPU architecture
(for example, ARM64 or AMD64). They can import it and use the direct run commands
above, from any directory with the required data/report folders:

```bash
docker image load -i improvement-hub-images.tar
```

No image is published to a registry automatically. After building/loading, direct
container runs need no dependency downloads. The test image can run with Docker's
`--network none` option. Do not use that option for the app's published web/API
ports. `.dockerignore` excludes local environments, databases, reports, and Git
history from the images; still review source contents before distributing them.

## QA

```bash
npm run test:e2e
npm run test:e2e -- --env prod
npm run test:e2e -- --tags "@smoke" --headed
npm run test:local
npm run test:startup
npm run test:docker
npm test -- --watch=false --browsers=ChromeHeadless
backend/.local-venv/bin/python -m pytest backend/tests -q
npm run build
```

E2E defaults to `dev`, the testing environment. It initializes/migrates that
environment's database, starts a backend and frontend on available ports, runs
Playwright + Cucumber, and stops both servers. `--env prod` uses the same database
as normal app startup. Test records remain in the selected environment; neither
database is deleted automatically. Use only synthetic data.

All environments and both native/Docker runs write HTML, JSON, JUnit reports and
failure traces to `e2e/reports/`. Open the latest report with:

```bash
npm run test:e2e:report
```

The entry page at `e2e/reports/index.html` shows the environment, native/Docker
test runtime, and start time above the Cucumber results. No `--env` is needed to
open it. Each run replaces the shared reports, including dry runs; do not run
multiple test commands concurrently into this directory. Database isolation is
unchanged. See [e2e/README.md](e2e/README.md) for details. `npm test` remains
the Angular unit-test command; it does not require a database.

`npm run test:docker` checks container app startup/shutdown for both environments.
`npm run test:e2e -- --docker` runs the browser scenarios in the test image.

Angular unit tests require Chrome. To reuse the installed Playwright Chromium:

```bash
CHROME_BIN="$(node -p 'require("@playwright/test").chromium.executablePath()')" npm test -- --watch=false --browsers=ChromeHeadless
```

## Local-only runtime

`npm run build` compiles the web app to `dist/app-501-improvement-hub/browser`.
Both local environments use the same application code and differ only in database
and preferred ports. There is no remote deployment or credential integration.
The backend accepts only SQLite database URLs, and the launcher overrides any
inherited `DATABASE_URL` with the selected local database.

[ci/README.md](ci/README.md) describes the shared launcher. `.local/` is ignored
by Git. To reset an environment, stop all processes using it and remove only its
`.local/prod/` or `.local/dev/` directory; the next run recreates it.

## Sharing safely

Use synthetic data only: this demo has no authentication or privacy-policy flow.
Do not distribute
`.git`, local environment files, virtual environments, caches, reports, or database
backups. Removing files from the current tree does not erase Git history or the
old submodule history; prepare a reviewed source-only export or a fresh repository
before sharing the demo externally.
