const ADMIN_EMAIL    = Cypress.env('ADMIN_EMAIL')    || 'david.everton@otech.edu';
const ADMIN_PASSWORD = Cypress.env('ADMIN_PASSWORD') || '';

// Unique run ID so stale notes from previous runs never interfere
const RUN = Date.now();

function addFollowUp(note) {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  cy.visit('/students');
  cy.get('table tbody tr').first().click();
  cy.contains('Open full details').click();
  cy.contains('[role="tab"]', 'Follow-ups').click();
  cy.contains('button', 'Add Follow-up').click();
  cy.get('input[type="date"]').first().then(($el) => {
    const el = $el[0];
    const nativeSetter = Object.getOwnPropertyDescriptor(
      el.ownerDocument.defaultView.HTMLInputElement.prototype, 'value'
    ).set;
    nativeSetter.call(el, tomorrow);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
  cy.get('input[placeholder*="What to follow up"]').type(note);
  cy.contains('button', 'Save').click();
  cy.contains(note).scrollIntoView().should('be.visible');
}

describe('Follow-ups workflow', () => {
  beforeEach(() => {
    cy.login(ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  it('can add a follow-up from the student detail page', () => {
    addFollowUp(`FU-add-${RUN}`);
  });

  it('shows the follow-up on the Task List page', () => {
    const note = `FU-list-${RUN}`;
    addFollowUp(note);

    cy.visit('/tasks');
    cy.get('h1').contains('Follow-up Tasks').should('be.visible');
    cy.contains(note).scrollIntoView().should('be.visible');
  });

  it('can mark a follow-up complete on the Task List page', () => {
    const note = `FU-complete-${RUN}`;
    addFollowUp(note);

    cy.visit('/tasks');
    cy.contains(note).scrollIntoView()
      .closest('div.rounded-lg')
      .find('button[title="Mark complete"]')
      .click({ force: true });

    // Completed items are removed from the pending list entirely
    cy.contains(note).should('not.exist');
  });

  it('completed follow-up is hidden by default and shown with toggle', () => {
    const note = `FU-hidden-${RUN}`;
    addFollowUp(note);

    cy.visit('/tasks');
    cy.contains(note).scrollIntoView()
      .closest('div.rounded-lg')
      .find('button[title="Mark complete"]')
      .click({ force: true });

    // Reload tasks — completed items are not in the DOM at all
    cy.visit('/tasks');
    cy.contains(note).should('not.exist');

    // Show completed — scroll the revealed item into view
    cy.contains('button', /Show completed/).click();
    cy.contains(note).scrollIntoView().should('be.visible');
  });

  it('Add Follow-up button is not visible for observers', () => {
    const obsEmail    = Cypress.env('OBSERVER_EMAIL')    || 'observer-test@otech.edu';
    const obsPassword = Cypress.env('OBSERVER_PASSWORD') || 'Test1234!';
    cy.login(obsEmail, obsPassword);

    cy.visit('/students');
    cy.get('table tbody tr').first().click();
    cy.contains('Open full details').click();
    cy.contains('[role="tab"]', 'Follow-ups').click();

    cy.contains('button', 'Add Follow-up').should('not.exist');
  });
});
