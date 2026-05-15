const ADMIN_EMAIL    = Cypress.env('ADMIN_EMAIL')    || 'david.everton@otech.edu';
const ADMIN_PASSWORD = Cypress.env('ADMIN_PASSWORD') || '';

describe('Students page', () => {
  beforeEach(() => {
    cy.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    cy.visit('/students');
  });

  it('shows the students list', () => {
    cy.get('h1').contains('Students').should('be.visible');
    cy.get('table').should('exist');
  });

  it('has an Add Student button for admin', () => {
    cy.contains('button', 'Add Student').should('be.visible');
  });

  it('has an Export button', () => {
    cy.contains('button', 'Export').should('be.visible');
  });

  it('filters students via the search box', () => {
    cy.get('input[placeholder*="Search"]').type('zzz_no_match');
    cy.contains('No students found').should('be.visible');
  });

  it('opens student summary panel on row click', () => {
    cy.get('table tbody tr').first().click();
    cy.contains('Student Summary').should('be.visible');
  });

  it('Show inactive toggle changes label', () => {
    cy.contains('button', 'Show inactive').click();
    cy.contains('button', 'Hide inactive').should('be.visible');
  });
});
