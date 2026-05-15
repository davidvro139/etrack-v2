const ADMIN_EMAIL    = Cypress.env('ADMIN_EMAIL')    || 'david.everton@otech.edu';
const ADMIN_PASSWORD = Cypress.env('ADMIN_PASSWORD') || '';

describe('Reflection Grader', () => {
  beforeEach(() => {
    cy.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    cy.intercept('GET', '**/canvas/reflections').as('getReflections');
    cy.visit('/reflections');
    cy.wait('@getReflections', { timeout: 15000 });
    // Wait for the panel to finish rendering (either shows buttons or empty state)
    cy.get('.w-72 .overflow-y-auto', { timeout: 10000 }).should(($el) => {
      const ready = $el.text().includes('No pending') || $el.find('button').length > 0;
      expect(ready).to.be.true;
    });
  });

  it('loads the Reflection Grader page', () => {
    cy.get('h1').contains('Reflection Grader').should('be.visible');
  });

  it('shows the Reload button', () => {
    cy.contains('button', 'Reload').should('be.visible');
  });

  it('shows pending submissions count in the subtitle', () => {
    cy.get('p').contains('pending').should('be.visible');
  });

  it('shows a search box for filtering submissions', () => {
    cy.get('input[placeholder*="Search student"]').should('be.visible');
  });

  it('shows submission list or empty state when loaded', () => {
    cy.get('.w-72 .overflow-y-auto').then(($panel) => {
      if ($panel.find('button').length > 0) {
        cy.get('.w-72 .overflow-y-auto button').should('have.length.greaterThan', 0);
      } else {
        cy.contains('No pending reflections').should('exist');
      }
    });
  });

  it('clicking a submission shows the answers panel', () => {
    cy.get('.w-72 .overflow-y-auto').then(($panel) => {
      if ($panel.find('button').length > 0) {
        cy.get('.w-72 .overflow-y-auto button').first().click();
        cy.contains('Course Deadline').should('be.visible');
        cy.contains('On Track').should('be.visible');
      }
      // No reflections — passes vacuously
    });
  });

  it('Pass and Fail buttons appear when a submission is selected', () => {
    cy.get('.w-72 .overflow-y-auto').then(($panel) => {
      if ($panel.find('button').length > 0) {
        cy.get('.w-72 .overflow-y-auto button').first().click();
        cy.contains('button', /Pass/).scrollIntoView().should('be.visible');
        cy.contains('button', /Fail/).scrollIntoView().should('be.visible');
      }
    });
  });

  it('search filters the submission list', () => {
    cy.get('input[placeholder*="Search student"]').type('zzz_no_match');
    // Empty state is inside the clipped .w-72 panel
    cy.contains('No pending reflections').should('exist');
  });
});
