const ADMIN_EMAIL    = Cypress.env('ADMIN_EMAIL')    || 'david.everton@otech.edu';
const ADMIN_PASSWORD = Cypress.env('ADMIN_PASSWORD') || '';

describe('Email Students page', () => {
  beforeEach(() => {
    cy.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    cy.visit('/email');
  });

  it('loads the Email Students page', () => {
    cy.get('h1').contains('Email Students').should('be.visible');
  });

  it('shows the template selector', () => {
    cy.contains('Template:').should('be.visible');
    cy.get('select').first().should('be.visible');
  });

  it('shows the student list with at least one student', () => {
    // Students are buttons inside the scrollable panel, not the Select All toggle
    cy.get('.w-72 .overflow-y-auto button').should('have.length.greaterThan', 0);
  });

  it('shows the student count in the footer', () => {
    cy.contains(/\d+ student/).should('be.visible');
  });

  it('shows the Select all toggle', () => {
    cy.contains('Select all').should('be.visible');
  });

  it('shows the student search box', () => {
    cy.get('input[placeholder*="Search students"]').should('be.visible');
  });

  it('filtering by name reduces the student list', () => {
    cy.get('input[placeholder*="Search students"]').type('zzz_no_match');
    // Only student buttons are counted — not the persistent Select All toggle
    cy.get('.w-72 .overflow-y-auto button').should('have.length', 0);
  });

  it('shows the New template button', () => {
    cy.contains('button', 'New').should('be.visible');
  });

  it('shows the CC personal email checkbox', () => {
    cy.contains("CC student's personal email").should('be.visible');
  });

  it('shows the Fix all-caps names checkbox', () => {
    cy.contains('Fix all-caps names').should('be.visible');
  });

  it('selecting a student updates the selected count', () => {
    // Click first student button (inside overflow panel, not the Select All toggle)
    cy.get('.w-72 .overflow-y-auto button').first().click();
    cy.contains('Select all (1 selected)').should('be.visible');
  });

  it('shows a placeholder when no template is selected', () => {
    cy.contains('Select or create a template to get started').should('be.visible');
  });
});
