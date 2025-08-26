describe('Admin User Management Workflow', () => {
  beforeEach(() => {
    // Intercept API calls to provide mock data
    // Load the fixture data first
    cy.fixture('users.json').then((users) => {
      // Now define the intercept, using the loaded data
      cy.intercept('GET', '/api/users*', {
        body: {
          data: users,
          totalCount: users.length,
        },
      }).as('getUsers');
    });
    cy.intercept('PUT', '/api/users', { statusCode: 200, body: { message: 'Rol de usuario actualizado con éxito' } }).as('updateUser');

    // 1. Set the role in localStorage BEFORE visiting the page.
    cy.login('admin');
    // 2. Visit the page, injecting the CSRF token into the window for the app to use.
    cy.visit('/admin/users', {
      onBeforeLoad(win) {
        win.__CSRF_TOKEN__ = Cypress.env('csrfToken');
      },
    });
  });

  it('should allow an admin to visit the user management page and see the user list', () => {
    // Wait for the API call to finish
    cy.wait('@getUsers');

    // Verify the main components of the page are visible
    cy.contains('h4', 'Administración de Usuarios').should('be.visible');

    // Verify the table headers are present
    cy.contains('th', 'Nombre Completo').should('be.visible');
    cy.contains('th', 'Email').should('be.visible');
    cy.contains('th', 'Rol').should('be.visible');
    cy.contains('th', 'Acciones').should('be.visible');

    // Check that our mock users are in the table
    cy.get('table > tbody').find('tr').should('have.length', 3);
    cy.contains('td', 'Test Admin User').should('be.visible');
    cy.contains('td', 'admin@example.com').should('be.visible');
    cy.contains('td', 'Test Mercaderista User').should('be.visible');
    cy.contains('td', 'mercaderista@example.com').should('be.visible');
  });
});
