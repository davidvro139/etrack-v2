const ADMIN_EMAIL    = Cypress.env('ADMIN_EMAIL')    || 'david.everton@otech.edu';
const ADMIN_PASSWORD = Cypress.env('ADMIN_PASSWORD') || '';

describe('Student edit workflow', () => {
  beforeEach(() => {
    cy.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    cy.visit('/students');
    cy.get('table tbody tr').first().click();
    cy.contains('Open full details').click();
    cy.url().should('match', /\/students\/\d+/);
  });

  it('shows the Edit button on the student detail page', () => {
    cy.contains('button', 'Edit').should('be.visible');
  });

  it('opens the edit dialog when Edit is clicked', () => {
    cy.contains('button', 'Edit').click();
    cy.contains('Edit Student').should('be.visible');
    cy.contains('button', 'Save changes').should('be.visible');
  });

  it('pre-fills the form with the existing student data', () => {
    // Get the student name from the page first
    cy.get('h1').invoke('text').then((name) => {
      cy.contains('button', 'Edit').click();
      // First name input should not be empty
      cy.contains('label', 'First Name').parent().find('input').should('not.have.value', '');
    });
  });

  it('saves updated status note and shows the change', () => {
    const note = `Cypress edit test — ${Date.now()}`;
    cy.contains('button', 'Edit').click();

    cy.contains('label', 'Status Note').parent().find('textarea').clear().type(note);
    cy.contains('button', 'Save changes').click();

    // Dialog closes
    cy.contains('button', 'Save changes').should('not.exist');

    // Status note visible on the page
    cy.contains(note).should('be.visible');
  });

  it('Cancel does not save changes', () => {
    cy.contains('button', 'Edit').click();

    cy.contains('label', 'Status Note').parent().find('textarea')
      .clear().type('This should not be saved');

    cy.contains('button', 'Cancel').click();
    cy.contains('button', 'Save changes').should('not.exist');
    cy.contains('This should not be saved').should('not.exist');
  });

  it('can update the current course', () => {
    cy.contains('button', 'Edit').click();

    cy.contains('label', 'Current Course').parent().find('input')
      .clear().type('Updated Course via Cypress');

    cy.contains('button', 'Save changes').click();
    cy.contains('Updated Course via Cypress').should('be.visible');
  });
});
