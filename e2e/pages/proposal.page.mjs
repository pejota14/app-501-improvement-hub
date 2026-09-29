import { expect } from '@playwright/test';
import { check, click, fillInput, navigate, selectOption } from '../utils/browser-actions.mjs';

export class ProposalPage {
  constructor({ page, baseURL }) {
    this.page = page;
    this.baseURL = baseURL;
    this.form = page.getByRole('form', { name: 'Share your improvement', exact: true });
    this.heading = page.getByRole('heading', { name: 'Share your improvement', exact: true });
    this.fields = {
      name: this.form.getByRole('textbox', { name: 'Your name', exact: true }),
      email: this.form.getByRole('textbox', { name: 'Email address', exact: true }),
      area: this.form.getByRole('combobox', { name: 'Area', exact: true }),
      title: this.form.getByRole('textbox', { name: 'Proposal title', exact: true }),
      description: this.form.getByRole('textbox', { name: 'Description', exact: true }),
    };
    this.impactGroup = this.form.getByRole('group', { name: 'Expected impact', exact: true });
    this.impacts = {
      low: this.impactGroup.getByRole('radio', { name: 'Low', exact: true }),
      medium: this.impactGroup.getByRole('radio', { name: 'Medium', exact: true }),
      high: this.impactGroup.getByRole('radio', { name: 'High', exact: true }),
    };
    this.submitButton = this.form.getByRole('button', { name: 'Submit proposal', exact: true });
    this.submissionError = this.form.getByRole('alert');
    this.emailError = this.form.getByText('Enter a valid email address.', { exact: true });
    this.impactError = this.impactGroup.getByText('Choose the expected impact.', { exact: true });
    this.success = page.getByRole('region', { name: 'Thank you for speaking up.', exact: true });
    this.successHeading = this.success.getByRole('heading', { name: 'Thank you for speaking up.', exact: true });
    this.submittedStatus = this.success.getByText('Submitted', { exact: true });
    this.anotherButton = this.success.getByRole('button', { name: 'Submit another proposal', exact: true });
  }

  reference(number) {
    return this.success.getByText(number, { exact: true });
  }

  async openForm() {
    await navigate(this.page, '/');
    await expect(this.heading).toBeVisible();
  }

  async fill(proposal) {
    await fillInput(this.fields.name, proposal.name);
    await fillInput(this.fields.email, proposal.email);
    await selectOption(this.fields.area, proposal.area);
    await fillInput(this.fields.title, proposal.title);
    await fillInput(this.fields.description, proposal.description);
    const impact = this.impacts[proposal.expectedImpact];
    if (!impact) throw new Error(`Unsupported impact: ${proposal.expectedImpact}`);
    await check(impact);
  }

  async submitProposal() {
    await click(this.submitButton);
  }

  async expectSubmissionConfirmation(referenceNumber) {
    await expect(this.successHeading).toBeVisible();
    await expect(this.reference(referenceNumber)).toBeVisible();
    await expect(this.submittedStatus).toBeVisible();
  }

  async startAnotherAndExpectEmptyForm() {
    await click(this.anotherButton);
    for (const field of Object.values(this.fields)) {
      await expect(field).toHaveValue('');
    }
    for (const impact of Object.values(this.impacts)) {
      await expect(impact).not.toBeChecked();
    }
  }

  async expectRequiredErrors() {
    for (const field of Object.values(this.fields)) {
      await expect(field).toHaveAttribute('aria-invalid', 'true');
    }
    await expect(this.impactError).toBeVisible();
    await expect(this.fields.name).toBeFocused();
  }

  async changeEmail(email) {
    await fillInput(this.fields.email, email);
  }

  async expectEmailError() {
    await expect(this.emailError).toBeVisible();
  }

  async expectSubmissionErrorWithRetainedEntries(proposal) {
    await expect(this.submissionError).toContainText('Your proposal was not sent.');
    for (const [name, field] of Object.entries(this.fields)) {
      await expect(field).toHaveValue(proposal[name]);
    }
    await expect(this.impacts[proposal.expectedImpact]).toBeChecked();
  }

  async visitUnknownUrl() {
    await navigate(this.page, '/unknown/nested/path');
  }

  async expectFormAtRoot() {
    await expect(this.page).toHaveURL(new URL('/', this.baseURL).href);
    await expect(this.heading).toBeVisible();
  }
}