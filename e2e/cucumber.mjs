const environment = process.env.E2E_ENV || 'dev';
if (!['prod', 'dev'].includes(environment)) throw new Error('E2E_ENV must be prod or dev');
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${environment === 'prod' ? 4200 : 4201}`;
const parsedURL = new URL(baseURL);
if (parsedURL.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(parsedURL.hostname)) {
  throw new Error('E2E_BASE_URL must point to a local HTTP server');
}
const reportDirectory = 'e2e/reports';

export default {
  paths: ['e2e/features/**/*.feature'],
  import: ['e2e/support/world.mjs', 'e2e/steps/**/*.mjs'],
  format: [
    'progress',
    `html:${reportDirectory}/cucumber.html`,
    `json:${reportDirectory}/cucumber.json`,
    `junit:${reportDirectory}/junit.xml`,
    `./e2e/report-index.mjs:${reportDirectory}/index.html`,
  ],
  formatOptions: {
    report: { environment, runtime: process.env.LOCAL_CONTAINER === '1' ? 'Docker' : 'Native' },
  },
  worldParameters: {
    environment,
    baseURL,
    reportDirectory,
  },
};