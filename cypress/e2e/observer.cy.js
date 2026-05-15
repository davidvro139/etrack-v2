const OBS_EMAIL    = Cypress.env('OBSERVER_EMAIL')    || 'observer-test@otech.edu';
const OBS_PASSWORD = Cypress.env('OBSERVER_PASSWORD') || 'Test1234!';

before(() => {
  cy.createUserViaApi('Test Observer', OBS_EMAIL, OBS_PASSWORD, 'observer');
});

describe('Observer role restrictions', () => {
  beforeEach(() => {
    cy.login(OBS_EMAIL, OBS_PASSWORD);
  });

  it('does NOT show Add Student button', () => {
    cy.visit('/students');
    cy.contains('button', 'Add Student').should('not.exist');
  });

  it('DOES show the Export button', () => {
    cy.visit('/students');
    cy.contains('button', 'Export').should('be.visible');
  });

  it('does NOT show Users nav item', () => {
    cy.get('nav').within(() => {
      cy.contains('Users').should('not.exist');
    });
  });

  it('shows a lock message on the Import page', () => {
    cy.visit('/import');
    cy.contains('not available for observers').should('be.visible');
  });

  it('does NOT show Log Interaction button on student detail', () => {
    cy.visit('/students');
    cy.get('table tbody tr').first().click();
    cy.contains('Open full details').click();
    cy.contains('button', 'Log Interaction').should('not.exist');
  });
});
