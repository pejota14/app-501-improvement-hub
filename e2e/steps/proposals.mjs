import { Given, Then, When } from '@cucumber/cucumber';
import { createProposal } from '../data/proposals.mjs';

Given('I open the proposal form', async function () {
  await this.proposalPage.openForm();
});

When('I enter a generated proposal for {string} with {string} impact', async function (area, impact) {
  this.proposal = createProposal({ area, expectedImpact: impact });
  await this.proposalPage.fill(this.proposal);
});

When('I submit the proposal', async function () {
  this.response = await this.api.captureSubmission(() => this.proposalPage.submitProposal());
});

Then('I receive a submission reference from the API', async function () {
  const receipt = await this.api.expectSubmissionReceipt(this.response);
  await this.proposalPage.expectSubmissionConfirmation(receipt.referenceNumber);
  await this.attach(JSON.stringify(receipt, null, 2), 'application/json');
});

Then('I can start another proposal with an empty form', async function () {
  await this.proposalPage.startAnotherAndExpectEmptyForm();
});

When('I try to submit the form', async function () {
  await this.proposalPage.submitProposal();
});

Then('all required fields show validation errors', async function () {
  await this.proposalPage.expectRequiredErrors();
});

Then('no proposal is sent to the API', function () {
  this.api.expectNoSubmission();
});

When('I change the email to {string}', async function (email) {
  this.proposal = { ...this.proposal, email };
  await this.proposalPage.changeEmail(email);
});

Then('I see an email validation error', async function () {
  await this.proposalPage.expectEmailError();
});

When('the next API submission is unavailable', async function () {
  await this.api.failNextSubmission();
});

Then('I see a submission error without losing my entries', async function () {
  this.api.expectStatus(this.response, 503);
  await this.proposalPage.expectSubmissionErrorWithRetainedEntries(this.proposal);
});

When('I send a proposal with {string} set to {string} directly to the API', async function (field, value) {
  this.proposal = { ...createProposal(), [field]: value };
  this.response = await this.api.submit(this.proposal);
});

Then('the API rejects the proposal with status {int}', function (statusCode) {
  this.api.expectStatus(this.response, statusCode);
});

When('I visit an unknown nested URL', async function () {
  await this.proposalPage.visitUnknownUrl();
});

Then('I see the proposal form at the root URL', async function () {
  await this.proposalPage.expectFormAtRoot();
});