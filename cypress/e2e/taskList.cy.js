const ADMIN_EMAIL    = Cypress.env('ADMIN_EMAIL')    || 'david.everton@otech.edu';
const ADMIN_PASSWORD = Cypress.env('ADMIN_PASSWORD') || '';

describe('Task List (Follow-ups) page', () => {
  beforeEach(() => {
    cy.login(ADMIN_EMAIL, ADMIN_PASSWORD);
    cy.visit('/tasks');
  });

  it('loads the Follow-up Tasks page', () => {
    cy.get('h1').contains('Follow-up Tasks').should('be.visible');
  });

  it('shows the Add Follow-up button for instructors', () => {
    cy.contains('button', 'Add Follow-up').should('be.visible');
  });

  it('opens the Add Follow-up form', () => {
    cy.contains('button', 'Add Follow-up').click();
    cy.contains('New Follow-up').should('be.visible');
    cy.contains('label', 'Student').should('be.visible');
    cy.contains('label', 'Due Date').should('be.visible');
  });

  it('student search dropdown filters as you type', () => {
    cy.contains('button', 'Add Follow-up').click();
    cy.get('input[placeholder*="Search by name"]').type('a');
    // Dropdown results should appear
    cy.get('.z-20').should('be.visible');
  });

  it('can create a follow-up from the task list', () => {
    const note = `Task list test — ${Date.now()}`;
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    cy.contains('button', 'Add Follow-up').click();
    cy.contains('New Follow-up').should('be.visible');

    // Pick first student — wait for chip to confirm selection registered
    cy.get('input[placeholder*="Search by name"]').type('a');
    cy.get('.z-20 button').first().click();
    cy.get('input[placeholder*="Search by name"]').should('not.exist'); // chip replaced the input

    // Use nativeInputValueSetter so React's controlled state actually updates
    cy.get('input[type="date"]').then(($el) => {
      const el = $el[0];
      const nativeSetter = Object.getOwnPropertyDescriptor(
        el.ownerDocument.defaultView.HTMLInputElement.prototype, 'value'
      ).set;
      nativeSetter.call(el, tomorrow);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    cy.get('input[type="date"]').should('have.value', tomorrow);

    cy.get('input[placeholder*="What to follow up"]').type(note);

    // Submit using the form container to avoid hitting the header toggle
    cy.contains('New Follow-up').closest('.rounded-lg').contains('button', 'Add Follow-up').click();

    // Form closes and follow-up appears in list
    cy.contains('New Follow-up').should('not.exist');
    cy.contains(note).scrollIntoView().should('be.visible');
  });

  it('Show completed toggle reveals completed items', () => {
    cy.contains('button', /Show completed/).click();
    cy.contains('button', /Hide completed/).should('be.visible');
  });

  it('can delete a follow-up', () => {
    cy.get('body').then(($body) => {
      if ($body.find('[title="Delete"]').length > 0) {
        cy.get('[title="Delete"]').first().click();
        // Item removed from list
        cy.get('[title="Delete"]').should('have.length.lessThan',
          $body.find('[title="Delete"]').length);
      }
    });
  });

  it('observer sees follow-ups but cannot add or complete them', () => {
    const obsEmail    = Cypress.env('OBSERVER_EMAIL')    || 'observer-test@otech.edu';
    const obsPassword = Cypress.env('OBSERVER_PASSWORD') || 'Test1234!';
    cy.login(obsEmail, obsPassword);
    cy.visit('/tasks');

    cy.get('h1').contains('Follow-up Tasks').should('be.visible');
    cy.contains('button', 'Add Follow-up').should('not.exist');
    cy.get('button[title="Mark complete"]').should('not.exist');
  });
});
