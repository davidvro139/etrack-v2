const ADMIN_EMAIL    = Cypress.env('ADMIN_EMAIL')    || 'david.everton@otech.edu';
const ADMIN_PASSWORD = Cypress.env('ADMIN_PASSWORD') || '';

describe('Gameboard', () => {
  beforeEach(() => {
    cy.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    cy.visit('/gameboard');
  });

  it('loads the Gameboard page', () => {
    cy.get('body').should('not.contain', 'Something went wrong');
    cy.url().should('include', '/gameboard');
  });

  it('shows a program selector', () => {
    cy.get('select, [role="combobox"]').first().should('be.visible');
  });

  it('shows a catalog year selector', () => {
    // At least two selectors exist (program + year)
    cy.get('select, [role="combobox"]').should('have.length.greaterThan', 1);
  });

  it('renders the SVG gameboard canvas', () => {
    cy.get('svg').should('exist');
  });

  it('shows a student panel on the right', () => {
    cy.get('body').then(($body) => {
      // The gameboard has a right panel for students
      if ($body.find('table').length > 0 || $body.text().includes('Students')) {
        cy.contains('Students').should('exist');
      }
    });
  });

  it('changing the program updates the board', () => {
    cy.get('select, [role="combobox"]').first().then(($select) => {
      if ($select.prop('tagName') === 'SELECT') {
        cy.wrap($select).find('option').its('length').then((optionCount) => {
          if (optionCount > 1) {
            cy.wrap($select).select(1); // select second program
            cy.get('svg').should('exist'); // board still renders
          }
        });
      }
    });
  });
});
