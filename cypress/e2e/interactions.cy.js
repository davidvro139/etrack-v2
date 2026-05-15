const ADMIN_EMAIL    = Cypress.env('ADMIN_EMAIL')    || 'david.everton@otech.edu';
const ADMIN_PASSWORD = Cypress.env('ADMIN_PASSWORD') || '';

describe('Interactions workflow', () => {
  beforeEach(() => {
    cy.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    cy.visit('/students');

    // Open the first student's full detail page
    cy.get('table tbody tr').first().click();
    cy.contains('Open full details').click();
    cy.url().should('match', /\/students\/\d+/);
  });

  it('shows the Interactions tab by default', () => {
    cy.contains('[role="tab"]', 'Interactions').should('have.attr', 'data-state', 'active');
  });

  it('shows the Log Interaction button for admin', () => {
    cy.contains('button', 'Log Interaction').should('be.visible');
  });

  it('opens the Log Interaction dialog', () => {
    cy.contains('button', 'Log Interaction').click();
    cy.contains('Log Interaction').should('be.visible'); // dialog title
    cy.contains('button', 'Save').should('be.visible');
  });

  it('logs a new interaction and shows it in the list', () => {
    cy.contains('button', 'Log Interaction').click();

    // Add notes
    cy.get('textarea').type('Cypress test interaction — checking in on progress.');

    // Save
    cy.contains('button', 'Save').click();

    // Dialog closes
    cy.contains('button', 'Save').should('not.exist');

    // Interaction appears in the list
    cy.contains('Cypress test interaction — checking in on progress.').should('be.visible');
  });

  it('can switch to the Outcomes tab', () => {
    cy.contains('[role="tab"]', 'Outcomes').click();
    cy.contains('button', 'Add Outcome').should('be.visible');
  });

  it('can switch to the Follow-ups tab', () => {
    cy.contains('[role="tab"]', 'Follow-ups').click();
    cy.contains('button', 'Add Follow-up').should('be.visible');
  });

  it('can switch to the Contacts tab', () => {
    cy.contains('[role="tab"]', 'Contacts').click();
    cy.contains('button', 'Add Contact').should('be.visible');
  });
});
