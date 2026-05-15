const ADMIN_EMAIL    = Cypress.env('ADMIN_EMAIL')    || 'david.everton@otech.edu';
const ADMIN_PASSWORD = Cypress.env('ADMIN_PASSWORD') || '';

describe('Student context menu', () => {
  beforeEach(() => {
    cy.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    cy.visit('/students');
  });

  it('opens on right-click', () => {
    cy.get('table tbody tr').first().rightclick();
    cy.contains('Open Details').should('be.visible');
    cy.contains('Mark as Inactive').should('be.visible');
    cy.contains('Archive').should('be.visible');
  });

  it('dismisses when clicking elsewhere', () => {
    cy.get('table tbody tr').first().rightclick();
    cy.contains('Open Details').should('be.visible');
    cy.get('h1').click();
    cy.contains('Open Details').should('not.exist');
  });

  it('Open Details navigates to the student detail page', () => {
    cy.get('table tbody tr').first().rightclick();
    cy.contains('Open Details').click();
    cy.url().should('match', /\/students\/\d+/);
    cy.contains('[role="tab"]', 'Interactions').should('be.visible');
  });

  it('Mark as Inactive changes the student badge and shows toast', () => {
    // Find an active student (has Active badge)
    cy.get('table tbody tr').contains('Active').closest('tr').rightclick();
    cy.contains('Mark as Inactive').click();

    // Toast notification appears
    cy.contains('marked inactive').should('be.visible');

    // Show inactive to verify student now has Inactive badge
    cy.contains('button', 'Show inactive').click();
    cy.get('table tbody tr').contains('Inactive').should('exist');
  });

  it('Archive prompts confirmation and hides student', () => {
    cy.get('table tbody tr').first().rightclick();
    cy.contains('Archive').click();

    // Cypress handles window.confirm automatically (accepts by default)
    cy.contains('archived').should('be.visible');

    // Student no longer in default list
    cy.contains('button', 'Show archived').click();
    cy.get('table tbody tr').contains('Archived').should('exist');
  });
});
