# Playwright + Cucumber

Gherkin scenarios in `features/` describe proposal submission behavior. Cucumber
executes the steps in `steps/`; Playwright drives Chromium and makes API requests.
Each scenario gets a fresh browser context and generated `example.com` contact
data. Runs use the persistent SQLite database belonging to the selected local
environment. The default is `dev`; `prod` is the normal app database.

## Page objects and utilities

| Layer | Responsibility |
| --- | --- |
| [steps/proposals.mjs](steps/proposals.mjs) | Coordinate page and API methods, store scenario data on World, pass parameters/results, and attach receipts; no selectors or inline assertions. |
| [pages/proposal.page.mjs](pages/proposal.page.mjs) | Define locators, perform UI interactions, and assert visible outcomes using supplied values; no API dependency or response state. |
| [utils/browser-actions.mjs](utils/browser-actions.mjs) | Reusable navigation, click, input, selection, and check functions accepting Playwright pages or locators. |
| [api/improvements.api.mjs](api/improvements.api.mjs) | Own API paths, response observation, direct requests, request counting, controlled failures, and API assertions; return validated receipts. |
| [data/proposals.mjs](data/proposals.mjs) | Generate synthetic proposal data independently of Cucumber or the browser. |
| [support/world.mjs](support/world.mjs) | Create fresh page/API instances per scenario and manage browser cleanup and artifacts. |

Steps call `ProposalPage` and `ImprovementsApi` independently. The page never calls
the API helper, parses a response, or stores a receipt. The scenario's World holds
the generated proposal and captured response between steps. API methods accept
responses as parameters; page methods accept the values needed for UI assertions.
For example, submission and confirmation steps coordinate this flow:

```js
this.response = await this.api.captureSubmission(() => this.proposalPage.submitProposal());
const receipt = await this.api.expectSubmissionReceipt(this.response);
await this.proposalPage.expectSubmissionConfirmation(receipt.referenceNumber);
await this.attach(JSON.stringify(receipt, null, 2), 'application/json');
```

Retry checks use the same separation: the API helper checks status 503, and the
page checks the error message and retained fields against the proposal parameter.
Test data is generated in the steps through `createProposal`, then passed to the
page or API. Each scenario has its own World, so this state is not shared across
tests.

The page delegates generic interactions to stateless utility functions. Utilities
do not contain proposal selectors, scenario state, assertions, fixed waits, forced
clicks, or error suppression; they preserve Playwright's auto-waiting and failures.

Define locators once in the page object using `getByRole` with exact accessible
names, scoped to the form, impact group, or success region. Use `getByText` for
visible status and error messages. Keep labels stable with `aria-labelledby`;
put counters and hints in `aria-describedby`, not in the control's name.
Assertions inspect named controls individually, rather than relying on global
counts of CSS matches. Do not use CSS classes, XPath, element indexes, or generated
regular expressions as substitutes for meaningful labels. Add a dedicated
`data-testid` only when a useful semantic locator is unavailable.

Locators remain lazy Playwright `Locator` objects; do not cache element handles.
Actions use Playwright auto-waiting, and the API helper registers response waits
before submission. Avoid fixed delays. The scenarios run with the English locale;
visible names deliberately follow that UI contract.

## Run

After the setup in the root README:

```bash
npm run test:e2e
npm run test:e2e -- --env prod
npm run test:e2e -- --tags "@smoke"
npm run test:e2e -- --tags "@DEMO-2"
npm run test:e2e -- --tags "@smoke or @resilience"
npm run test:e2e -- --tags "@validation and not @api"
npm run test:e2e -- --env prod --tags "@api and @validation"
E2E_VIEWPORT=mobile npm run test:e2e
npm run test:e2e -- --headed --tags "@smoke"
npm run test:e2e -- --docker --tags "@smoke or @resilience"
npm run test:e2e -- --docker --headed --tags "@smoke"
npm run test:e2e:dry
```

Use `--tags` with a quoted Cucumber expression: `and` requires both tags, `or`
accepts either, and `not` excludes a tag. Parentheses can group expressions.
Omitting `--tags` runs all scenarios; tag selection no longer reads `E2E_TAGS`.
The first `--` tells npm to pass the remaining arguments to the test command.
The same tag option works with `test:e2e:dry` and `test:e2e:attached`.

Every Scenario or Scenario Outline has one unique ID tag, currently `@DEMO-1`
through `@DEMO-7`. Selecting an outline's ID runs all of its example rows. Keep
existing IDs stable and assign new IDs when adding scenarios or outlines;
category tags such as `@smoke` remain available.

The browser is headless by default: it runs without a visible window. `--headed`
opens a visible Chromium window so you can watch the tests; it does not pause or
slow them down. Browser visibility is independent of tag and environment selection.
The flag is available on `test:e2e`; `HEADED=1` remains supported for compatibility
and for `test:e2e:attached`, which calls Cucumber directly.

`--docker` builds and runs the separate `improvement-hub:e2e` image with the API,
frontend, SQLite, and Chromium already installed. Host Node and a running local
Docker engine are sufficient; skip native dependency/browser setup. Environments,
tag expressions, database files, reports, exit status, and shutdown behavior remain
the same. `E2E_VIEWPORT=mobile` is forwarded to the container. Test app/API ports
stay private to the container.

In Docker, `--headed` uses a virtual display viewed at the printed
`Browser desktop:` URL, not a native desktop window. The noVNC viewer is exposed
only on localhost, requires no password, and closes when tests finish. Tests do
not wait for a viewer. Native `--headed` still opens Chromium directly.

The Docker flag is supported by the managed `test:e2e` command, not the direct
`test:e2e:attached`/`test:e2e:dry` commands. Direct image commands and importing
prebuilt images without host Node/Python are in the
[Docker fallback guide](../README.md#docker-fallback).

The shared launcher prepares Python dependencies, selects available ports,
overrides `DATABASE_URL`, initializes the selected database if missing, and applies
Alembic migrations before startup. The readiness timeout is two minutes per server.
Set `LOCAL_PYTHON` to select a Python environment; `E2E_PYTHON` remains an alias.

For an already running local app with an `/api` proxy, use its printed URL:

```bash
E2E_ENV=prod E2E_BASE_URL=http://127.0.0.1:4200 npm run test:e2e:attached
```

Attached mode does not initialize databases or manage servers. `E2E_ENV` labels
reports; the attached server determines the actual database. Only local HTTP URLs
are accepted. Both managed and attached runs retain synthetic proposal records.
Tests explicitly run with `--env prod` write to the normal local app database.
Only the resilience scenario simulates a single 503 response;
successful submissions and API validation use the real backend.

## Coverage and strategy

- Four successful proposal variants, receipt checks, and form reset.
- Required fields and invalid email blocked before an API submission.
- Form correction and successful submission after required-field errors appear.
- API-level rejection of invalid email, area, impact, and description.
- Error message, retained entries, and successful retry after a simulated outage.
- Unknown nested URLs returning to the web application.
- Backend pytest tests cover stored fields, persistence failures, and configuration.

Keep fast validation and persistence checks in pytest; use these browser scenarios
for critical user journeys. Both local environments use SQLite. Review Gherkin
examples as acceptance criteria.

## Reports and cleanup

Every run uses the single `e2e/reports/` directory, regardless of environment or
native/Docker execution. `index.html` shows the environment, test runtime, and
start time above the standard `cucumber.html` results. The run also writes
`cucumber.json` and `junit.xml`. Executed scenarios include an environment text
attachment in the Cucumber HTML/JSON output. Failed scenarios attach screenshots
and save Playwright trace ZIPs alongside the reports:

```bash
npx playwright show-trace e2e/reports/<trace-id>.zip
```

Open the HTML report in your default browser (macOS or desktop Linux):

```bash
npm run test:e2e:report
```

The opener always shows the latest run and no longer accepts `--env`. Run it on
the host for both native and Docker reports; it does not start servers or rerun
tests. Linux requires `xdg-open`. Keep `index.html` and `cucumber.html` together
when moving or sharing the report, since the entry page embeds the Cucumber file.

Reports are Git-ignored and overwritten by the next run in any environment,
including a dry run. Run test commands sequentially to avoid conflicting writes.
Previously generated `dev/` and `prod/` report directories are left untouched;
new runs no longer use them. Old trace ZIPs remain until removed. Traces can contain request
data, so use synthetic data only. Managed runs stop their servers on success,
failure, SIGINT or SIGTERM. Database contents survive all normal runs. A hard kill
or machine crash can leave processes that need manual cleanup.

To reset test data, stop every run using `dev` and remove `.local/dev/`. The next
run initializes it again. Resetting `.local/prod/` also deletes manual demo entries.