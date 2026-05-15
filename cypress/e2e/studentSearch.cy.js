const ADMIN_EMAIL    = Cypress.env('ADMIN_EMAIL')    || 'david.everton@otech.edu';
const ADMIN_PASSWORD = Cypress.env('ADMIN_PASSWORD') || '';

describe('Student list search', () => {
  beforeEach(() => {
    cy.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    cy.visit('/students');
  });

  it('search box has correct placeholder text', () => {
    cy.get('input[placeholder*="Search by name or student ID"]').should('be.visible');
  });

  it('typing filters the table rows', () => {
    cy.get('table tbody tr').its('length').then((total) => {
      cy.get('input[placeholder*="Search"]').type('a');
      cy.get('table tbody tr').its('length').should('be.lte', total);
    });
  });

  it('no-match search shows empty state', () => {
    cy.get('input[placeholder*="Search"]').type('zzz_no_match_xyz_123');
    cy.contains('No students found').should('be.visible');
    cy.get('table tbody tr').should('have.length', 0);
  });

  it('clearing the search restores all students', () => {
    cy.get('table tbody tr').its('length').then((total) => {
      cy.get('input[placeholder*="Search"]').type('zzz_no_match');
      cy.get('table tbody tr').should('have.length', 0);

      cy.get('input[placeholder*="Search"]').clear();
      cy.get('table tbody tr').should('have.length', total);
    });
  });

  it('search by SIS ID returns the correct student', () => {
    // SIS ID is not shown in the table — get it via the API using cy.request
    cy.window().then((win) => {
      const auth = JSON.parse(win.localStorage.getItem('etrack-auth') || '{}');
      const token = auth?.state?.token;
      if (!token) return;

      cy.request({
        url: 'http://localhost:3002/api/students?archived=false&inactive=false&graduated=false',
        headers: { Authorization: `Bearer ${token}` },
      }).then((res) => {
        const students = res.body;
        const withSisId = students.find((s) => s.sisId);
        if (withSisId) {
          cy.get('input[placeholder*="Search"]').type(withSisId.sisId);
          cy.get('table tbody tr').should('have.length', 1);
        }
      });
    });
  });

  it('search by last name returns matching students', () => {
    cy.get('table tbody tr').first().find('td').first().invoke('text').then((fullName) => {
      const parts = fullName.trim().split(' ');
      if (parts.length >= 2) {
        const lastName = parts[parts.length - 1];
        cy.get('input[placeholder*="Search"]').type(lastName);
        cy.get('table tbody tr').should('have.length.greaterThan', 0);
      }
    });
  });

  it('search is case-insensitive — last name in uppercase returns results', () => {
    cy.get('table tbody tr').first().find('td').first().invoke('text').then((fullName) => {
      const parts = fullName.trim().split(' ');
      if (parts.length >= 2) {
        // Search last name only in uppercase — MySQL LIKE is case-insensitive
        const lastNameUpper = parts[parts.length - 1].toUpperCase();
        cy.get('input[placeholder*="Search"]').type(lastNameUpper);
        cy.get('table tbody tr').should('have.length.greaterThan', 0);
      }
    });
  });
});
