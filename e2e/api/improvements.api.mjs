import { expect } from '@playwright/test';

const endpoint = '/api/improvements';

export class ImprovementsApi {
  constructor(page) {
    this.page = page;
    this.request = page.context().request;
    this.submissionRequests = 0;
    this.observeRequest = (request) => {
      if (this.isSubmission(request)) this.submissionRequests += 1;
    };
    page.on('request', this.observeRequest);
  }

  isSubmission(request) {
    return request.method() === 'POST' && new URL(request.url()).pathname === endpoint;
  }

  async captureSubmission(action) {
    const [response] = await Promise.all([
      this.page.waitForResponse((response) => this.isSubmission(response.request())),
      action(),
    ]);
    return response;
  }

  async submit(proposal) {
    return this.request.post(endpoint, { data: proposal });
  }

  expectStatus(response, statusCode) {
    expect(response.status()).toBe(statusCode);
  }

  async expectSubmissionReceipt(response) {
    this.expectStatus(response, 201);
    const receipt = await response.json();
    expect(receipt.referenceNumber).toMatch(/^IH-/);
    expect(receipt.status).toBe('Submitted');
    expect(Number.isNaN(Date.parse(receipt.createdAt))).toBe(false);
    return receipt;
  }

  expectNoSubmission() {
    expect(this.submissionRequests).toBe(0);
  }

  async failNextSubmission() {
    const handler = async (route) => {
      if (!this.isSubmission(route.request())) return route.fallback();
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Unable to submit proposal at this time.' }),
      });
      await this.page.unroute(matchesEndpoint, handler);
    };
    const matchesEndpoint = (url) => url.pathname === endpoint;
    await this.page.route(matchesEndpoint, handler);
  }

  dispose() {
    this.page.off('request', this.observeRequest);
  }
}