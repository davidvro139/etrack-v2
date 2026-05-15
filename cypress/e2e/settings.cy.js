const ADMIN_EMAIL    = Cypress.env('ADMIN_EMAIL')    || 'david.everton@otech.edu';
const ADMIN_PASSWORD = Cypress.env('ADMIN_PASSWORD') || '';

describe('Settings page', () => {
  beforeEach(() => {
    cy.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    cy.visit('/settings');
  });

  it('loads the Settings page', () => {
    cy.get('h1').contains('Settings').should('be.visible');
  });

  it('shows the Profile card with name and login email fields', () => {
    cy.contains('Display Name').should('be.visible');
    cy.contains('Login Email').should('be.visible');
    cy.contains('label', 'Login Email').parent().find('input')
      .should('have.value', ADMIN_EMAIL)
      .should('be.disabled');
  });

  it('shows the Canvas LMS card', () => {
    cy.contains('Canvas LMS').scrollIntoView().should('be.visible');
    cy.contains('Canvas Site URL').should('be.visible');
    cy.contains('Canvas API Token').should('be.visible');
  });

  it('shows the Database Backup card for admin', () => {
    cy.contains('Database Backup').scrollIntoView().should('be.visible');
    cy.contains('button', 'Save Backup').scrollIntoView().should('be.visible');
  });

  it('has a Save Settings button', () => {
    cy.contains('button', 'Save Settings').scrollIntoView().should('be.visible');
  });

  it('can update the display name and save', () => {
    cy.contains('label', 'Display Name').parent().find('input')
      .clear().type('Cypress Updated Name');

    cy.contains('button', 'Save Settings').scrollIntoView().click();
    cy.contains('Saved!').should('be.visible');

    // Restore original name
    cy.contains('label', 'Display Name').parent().find('input')
      .clear().type('david.everton');
    cy.contains('button', 'Save Settings').scrollIntoView().click();
  });

  it('Database Backup card is NOT visible for observers', () => {
    const obsEmail    = Cypress.env('OBSERVER_EMAIL')    || 'observer-test@otech.edu';
    const obsPassword = Cypress.env('OBSERVER_PASSWORD') || 'Test1234!';
    cy.login(obsEmail, obsPassword);
    cy.visit('/settings');

    cy.contains('Database Backup').should('not.exist');
    cy.get('h1').contains('Settings').should('be.visible');
  });
});
