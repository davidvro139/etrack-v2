Cypress.Commands.add('login', (email, password) => {
  cy.visit('/login');
  cy.get('#email').should('not.be.disabled').type(email);
  cy.get('#password').should('not.be.disabled').type(password);
  cy.get('button[type="submit"]').click();
  cy.url().should('include', '/students');
});

Cypress.Commands.add('createUserViaApi', (name, email, password, role) => {
  const apiUrl = Cypress.env('API_URL') || 'http://localhost:3002/api';
  const adminEmail = Cypress.env('ADMIN_EMAIL');
  const adminPassword = Cypress.env('ADMIN_PASSWORD');

  cy.request('POST', `${apiUrl}/auth/login`, { email: adminEmail, password: adminPassword })
    .then((res) => {
      const token = res.body.token;
      cy.request({
        method: 'POST',
        url: `${apiUrl}/auth/register`,
        headers: { Authorization: `Bearer ${token}` },
        body: { name, email, password, role },
        failOnStatusCode: false,
      });
    });
});
