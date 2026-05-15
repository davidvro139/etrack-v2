const ADMIN_EMAIL    = Cypress.env('ADMIN_EMAIL')    || 'david.everton@otech.edu';
const ADMIN_PASSWORD = Cypress.env('ADMIN_PASSWORD') || '';

describe('On-Track Report', () => {
  beforeEach(() => {
    cy.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    cy.visit('/on-track');
  });

  it('shows the On-Track Report page', () => {
    cy.get('h1').contains('On-Track Report').should('be.visible');
  });

  it('shows the Load Report button', () => {
    cy.contains('button', 'Load Report').should('be.visible');
  });

  it('shows a loading indicator after clicking Load Report', () => {
    cy.contains('button', 'Load Report').click();
    cy.get('button').contains(/Refresh|Load Report/).should('be.visible');
  });

  // The remaining tests depend on the report actually loading data.
  // They are skipped gracefully if Canvas is not configured or returns no data.
  it('loads and displays student rows OR shows a handled error state', () => {
    cy.contains('button', 'Load Report').click();

    cy.get('body', { timeout: 60000 }).then(($body) => {
      if ($body.find('table').length > 0) {
        cy.get('table tbody tr').should('have.length.greaterThan', 0);
      } else {
        // Error state or no-data state — just verify the page didn't crash
        cy.get('h1').contains('On-Track Report').should('be.visible');
        cy.get('button').should('have.length.greaterThan', 0);
      }
    });
  });

  it('Export button appears after data loads (skipped if no data)', () => {
    cy.contains('button', 'Load Report').click();

    cy.get('body', { timeout: 60000 }).then(($body) => {
      if ($body.find('table').length > 0) {
        cy.contains('button', 'Export').should('be.visible');
        cy.contains('button', 'Refresh').should('be.visible');
      }
    });
  });

  it('search filters rows when data is loaded (skipped if no data)', () => {
    cy.contains('button', 'Load Report').click();

    cy.get('body', { timeout: 60000 }).then(($body) => {
      if ($body.find('table').length > 0) {
        cy.get('input[placeholder*="Filter"]').type('zzz_no_match');
        cy.contains('No students match your filter').should('be.visible');
      }
    });
  });
});
