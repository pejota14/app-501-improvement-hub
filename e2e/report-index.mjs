import { Formatter } from '@cucumber/cucumber';

export default class ReportIndex extends Formatter {
  constructor(options) {
    super(options);
    const { environment, runtime } = options.parsedArgvOptions.report;
    if (!['dev', 'prod'].includes(environment) || !['Native', 'Docker'].includes(runtime)) {
      throw new Error('Invalid report environment or runtime');
    }
    const startedAt = new Date().toISOString();
    this.log(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Improvement Hub | Environment: ${environment}</title>
  <style>
    html, body { margin: 0; height: 100%; }
    body { display: grid; grid-template-rows: auto minmax(0, 1fr); font: 14px sans-serif; color: #17323b; }
    header { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 24px; padding: 12px 16px; background: #f6f9f9; border-bottom: 1px solid #cfdddf; }
    h1 { margin: 0; font-size: 18px; }
    time { overflow-wrap: anywhere; }
    iframe { width: 100%; height: 100%; min-height: 0; border: 0; }
  </style>
</head>
<body>
  <header>
    <h1>Environment: ${environment}</h1>
    <span>${runtime}</span>
    <time datetime="${startedAt}">${startedAt}</time>
  </header>
  <iframe src="cucumber.html" title="Cucumber results"></iframe>
</body>
</html>
`);
  }
}