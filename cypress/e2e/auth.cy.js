const ADMIN_EMAIL    = Cypress.env('ADMIN_EMAIL')    || 'david.everton@otech.edu';
const ADMIN_PASSWORD = Cypress.env('ADMIN_PASSWORD') || '';

describe('Authentication', () => {
  it('redirects unauthenticated users to /login', () => {
    cy.visit('/');
    cy.url().should('include', '/login');
  });

  it('redirects /students to /login when not logged in', () => {
    cy.visit('/students');
    cy.url().should('include', '/login');
  });

  it('shows the login form', () => {
    cy.visit('/login');
    cy.get('#email').should('be.visible');
    cy.get('#password').should('be.visible');
    cy.get('button[type="submit"]').contains('Sign in').should('be.visible');
  });

  it('shows an error message on wrong credentials', () => {
    cy.visit('/login');
    cy.get('#email').type('nobody@example.com');
    cy.get('#password').type('wrongpassword');
    cy.get('button[type="submit"]').click();
    cy.contains('Invalid email or password').should('be.visible');
  });

  it('logs in successfully and lands on students page', () => {
    cy.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    cy.get('h1').contains('Students').should('be.visible');
  });

  it('shows the admin Users nav item after login', () => {
    cy.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    cy.get('nav').contains('Users').should('be.visible');
  });

  it('logs out and redirects to login page', () => {
    cy.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    cy.contains('Sign out').click();
    cy.url().should('include', '/login');
  });
});
