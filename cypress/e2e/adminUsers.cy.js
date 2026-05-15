const ADMIN_EMAIL    = Cypress.env('ADMIN_EMAIL')    || 'david.everton@otech.edu';
const ADMIN_PASSWORD = Cypress.env('ADMIN_PASSWORD') || '';

const TEST_EMAIL = `cypress-user-${Date.now()}@test.com`;

describe('Admin user management', () => {
  beforeEach(() => {
    cy.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    cy.visit('/admin/users');
  });

  it('shows the User Management page', () => {
    cy.get('h1').contains('User Management').should('be.visible');
  });

  it('shows the Add User button', () => {
    cy.contains('button', 'Add User').should('be.visible');
  });

  it('shows existing users in a table', () => {
    cy.get('table').should('exist');
    cy.get('table tbody tr').should('have.length.greaterThan', 0);
  });

  it('lists the admin user with correct role', () => {
    cy.get('table tbody tr').contains(ADMIN_EMAIL).closest('tr')
      .find('select').should('have.value', 'admin');
  });

  it('opens the Add User form', () => {
    cy.contains('button', 'Add User').click();
    cy.contains('New User').should('be.visible');
    cy.contains('button', 'Create User').should('be.visible');
  });

  it('creates a new instructor user', () => {
    cy.contains('button', 'Add User').click();

    cy.contains('label', 'Name').parent().find('input').type('Cypress Test User');
    cy.contains('label', 'Email').parent().find('input').type(TEST_EMAIL);
    cy.contains('label', 'Password').parent().find('input').type('TestPass123!');
    // Role defaults to Instructor — leave it

    cy.contains('button', 'Create User').click();

    // Form closes, new user appears in table
    cy.contains('button', 'Create User').should('not.exist');
    cy.contains(TEST_EMAIL).should('be.visible');
  });

  it('can change a user role via the dropdown', () => {
    cy.contains(TEST_EMAIL).closest('tr').find('select').select('observer');
    // Row still shows the email after the update
    cy.contains(TEST_EMAIL).should('be.visible');
  });

  it('can deactivate a user', () => {
    cy.contains(TEST_EMAIL).closest('tr')
      .contains('button', 'Deactivate').click();

    cy.contains(TEST_EMAIL).closest('tr')
      .contains('button', 'Reactivate').should('be.visible');
  });

  it('can reactivate a deactivated user', () => {
    cy.contains(TEST_EMAIL).closest('tr')
      .contains('button', 'Reactivate').click();

    cy.contains(TEST_EMAIL).closest('tr')
      .contains('button', 'Deactivate').should('be.visible');
  });

  it('deletes a user after confirmation', () => {
    // Accept the confirm dialog
    cy.on('window:confirm', () => true);

    cy.contains(TEST_EMAIL).closest('tr')
      .find('button[title="Delete user"]').click();

    cy.contains(TEST_EMAIL).should('not.exist');
  });

  it('cannot be accessed by a non-admin (redirects or shows error)', () => {
    const obsEmail    = Cypress.env('OBSERVER_EMAIL')    || 'observer-test@otech.edu';
    const obsPassword = Cypress.env('OBSERVER_PASSWORD') || 'Test1234!';
    cy.login(obsEmail, obsPassword);

    cy.visit('/admin/users');
    // Either redirected away or API returns 403
    cy.get('body').should('not.contain', 'User Management');
  });
});
