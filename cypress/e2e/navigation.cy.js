const ADMIN_EMAIL    = Cypress.env('ADMIN_EMAIL')    || 'david.everton@otech.edu';
const ADMIN_PASSWORD = Cypress.env('ADMIN_PASSWORD') || '';

const NAV_ITEMS = [
  { label: 'Students',          path: '/students' },
  { label: 'On-Track Report',   path: '/on-track' },
  { label: 'Inactive Report',   path: '/inactive-report' },
  { label: 'Follow-ups',        path: '/tasks' },
  { label: 'Reflection Grader', path: '/reflections' },
  { label: 'Email Students',    path: '/email' },
  { label: 'Gameboard',         path: '/gameboard' },
  { label: 'Northstar Import',  path: '/import' },
  { label: 'Settings',          path: '/settings' },
  { label: 'Users',             path: '/admin/users' },
];

describe('Navigation smoke tests', () => {
  before(() => {
    cy.login(ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  NAV_ITEMS.forEach(({ label, path }) => {
    it(`navigates to ${label} without crashing`, () => {
      cy.visit(path);
      // Page should not show a blank screen or uncaught error
      cy.get('body').should('not.be.empty');
      // Should still be on the expected path
      cy.url().should('include', path);
      // No full-page error boundary message
      cy.contains('Something went wrong').should('not.exist');
    });
  });

});

describe('Active nav link state', () => {
  beforeEach(() => {
    cy.login(ADMIN_EMAIL, ADMIN_PASSWORD);
  });

  it('sidebar nav link for Students is active on /students', () => {
    cy.visit('/students');
    cy.get('nav a[href="/students"]').should('have.class', 'bg-accent');
  });

  it('sidebar nav link for Settings is active on /settings', () => {
    cy.visit('/settings');
    cy.get('nav a[href="/settings"]').should('have.class', 'bg-accent');
  });
});
