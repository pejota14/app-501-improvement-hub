import { mkdir } from 'node:fs/promises';
import {
  After, AfterAll, Before, BeforeAll, setDefaultTimeout, setWorldConstructor,
  Status, World,
} from '@cucumber/cucumber';
import { chromium } from '@playwright/test';
import { ImprovementsApi } from '../api/improvements.api.mjs';
import { ProposalPage } from '../pages/proposal.page.mjs';

let browser;

class ProposalWorld extends World {}

setWorldConstructor(ProposalWorld);
setDefaultTimeout(30_000);

BeforeAll(async function () {
  browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
});

Before(async function () {
  await this.attach(`Environment: ${this.parameters.environment}`, 'text/plain');
  await mkdir(this.parameters.reportDirectory, { recursive: true });
  this.context = await browser.newContext({
    baseURL: this.parameters.baseURL,
    locale: 'en-US',
    viewport: process.env.E2E_VIEWPORT === 'mobile'
      ? { width: 390, height: 844 }
      : { width: 1440, height: 1000 },
  });
  await this.context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  this.page = await this.context.newPage();
  this.api = new ImprovementsApi(this.page);
  this.proposalPage = new ProposalPage({
    page: this.page,
    baseURL: this.parameters.baseURL,
  });
});

After(async function ({ result, testCaseStartedId }) {
  if (!this.context) return;
  try {
    if (result?.status === Status.FAILED) {
      if (this.page && !this.page.isClosed()) {
        await this.attach(await this.page.screenshot({ fullPage: true }), 'image/png');
      }
      const tracePath = `${this.parameters.reportDirectory}/${testCaseStartedId}.zip`;
      await this.context.tracing.stop({ path: tracePath });
      await this.attach(`Playwright trace: ${tracePath}`, 'text/plain');
    } else {
      await this.context.tracing.stop();
    }
  } finally {
    this.api?.dispose();
    await this.context.close();
  }
});

AfterAll(async function () {
  await browser?.close();
});