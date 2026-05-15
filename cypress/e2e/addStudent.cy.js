const ADMIN_EMAIL    = Cypress.env('ADMIN_EMAIL')    || 'david.everton@otech.edu';
const ADMIN_PASSWORD = Cypress.env('ADMIN_PASSWORD') || '';

// Use a timestamp so the name is unique across test runs
const FIRST = `Cypress`;
const LAST  = `Student-${Date.now()}`;

describe('Add Student workflow', () => {
  beforeEach(() => {
    cy.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    cy.visit('/students');
  });

  it('opens the Add Student dialog when the button is clicked', () => {
    cy.contains('button', 'Add Student').click();
    cy.contains('Add Student').should('be.visible'); // dialog title
    cy.contains('button', 'Add student').should('be.visible'); // submit button
  });

  it('creates a new student and shows them in the list', () => {
    cy.contains('button', 'Add Student').click();

    // Fill required fields
    cy.contains('label', 'First Name').parent().find('input').type(FIRST);
    cy.contains('label', 'Last Name').parent().find('input').type(LAST);
    cy.contains('label', 'Program').parent().find('input').type('IT Support');
    cy.contains('label', 'Current Course').parent().find('input').type('CompTIA A+');

    // Submit
    cy.contains('button', 'Add student').click();

    // Dialog should close
    cy.contains('button', 'Add student').should('not.exist');

    // Search for the new student to bring them into view
    cy.get('input[placeholder*="Search"]').type(LAST);
    cy.contains(`${FIRST} ${LAST}`).should('be.visible');
  });

  it('shows a validation error when required fields are missing', () => {
    cy.contains('button', 'Add Student').click();

    // Try to submit without filling anything
    cy.contains('button', 'Add student').click();

    // Browser required validation prevents submission — dialog stays open
    cy.contains('button', 'Add student').should('be.visible');
  });

  it('cancels without creating a student', () => {
    cy.contains('button', 'Add Student').click();
    cy.contains('label', 'First Name').parent().find('input').type('ShouldNotAppear');
    cy.contains('button', 'Cancel').click();

    // Dialog closed
    cy.contains('button', 'Add student').should('not.exist');

    // Search confirms student was not created
    cy.get('input[placeholder*="Search"]').type('ShouldNotAppear');
    cy.contains('No students found').should('be.visible');
  });
});
