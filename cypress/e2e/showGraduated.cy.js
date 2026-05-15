const ADMIN_EMAIL    = Cypress.env('ADMIN_EMAIL')    || 'david.everton@otech.edu';
const ADMIN_PASSWORD = Cypress.env('ADMIN_PASSWORD') || '';

describe('Show Graduated / Archived filter toggles', () => {
  beforeEach(() => {
    cy.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    cy.visit('/students');
  });

  it('Show graduated button exists in the toolbar', () => {
    cy.contains('button', 'Show graduated').should('be.visible');
  });

  it('Show archived button exists in the toolbar', () => {
    cy.contains('button', 'Show archived').should('be.visible');
  });

  it('Show graduated toggles to Hide graduated when clicked', () => {
    cy.contains('button', 'Show graduated').click();
    cy.contains('button', 'Hide graduated').should('be.visible');
  });

  it('Hide graduated toggles back to Show graduated', () => {
    cy.contains('button', 'Show graduated').click();
    cy.contains('button', 'Hide graduated').click();
    cy.contains('button', 'Show graduated').should('be.visible');
  });

  it('Show inactive toggles correctly', () => {
    cy.contains('button', 'Show inactive').click();
    cy.contains('button', 'Hide inactive').should('be.visible');
    cy.contains('button', 'Hide inactive').click();
    cy.contains('button', 'Show inactive').should('be.visible');
  });

  it('Show archived shows Archived badge students', () => {
    cy.contains('button', 'Show archived').click();
    cy.get('body').then(($body) => {
      // If any archived students exist they should show the Archived badge
      if ($body.text().includes('Archived')) {
        cy.get('table tbody tr').contains('Archived').should('exist');
      }
    });
  });

  it('multiple filters can be active at the same time', () => {
    cy.contains('button', 'Show inactive').click();
    cy.contains('button', 'Show graduated').click();

    // Both toggles are active (both show "Hide" state)
    cy.contains('button', 'Hide inactive').should('be.visible');
    cy.contains('button', 'Hide graduated').should('be.visible');
  });
});
