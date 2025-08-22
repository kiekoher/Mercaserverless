describe('Admin User Management Workflow', () => {
  beforeEach(() => {
    // Intercept API calls to provide mock data
    cy.intercept('GET', '/api/users', { fixture: 'users.json' }).as('getUsers');
    cy.intercept('PUT', '/api/users', { statusCode: 200, body: { message: 'Rol de usuario actualizado con éxito' } }).as('updateUser');
  });

  it('should allow an admin to visit the user management page and see the user list', () => {
    // 1. Log in and visit the page
    cy.login('admin', '/admin/users');
    cy.reload(); // Force a reload to ensure the AuthProvider picks up the localStorage

    // 2. Wait for the API call to finish
    cy.wait('@getUsers');

    // 3. Verify the main components of the page are visible
    cy.contains('h4', 'Administración de Usuarios').should('be.visible');

    // 4. Verify the table headers are present
    cy.contains('th', 'ID de Usuario').should('be.visible');
    cy.contains('th', 'Rol').should('be.visible');
    cy.contains('th', 'Acciones').should('be.visible');

    // 5. Check that our mock users are in the table
    cy.get('table > tbody').find('tr').should('have.length', 3);
    cy.contains('td', 'Test Admin User').should('be.visible');
    cy.contains('td', 'Test Mercaderista User').should('be.visible');
  });

  it('should allow an admin to change a user role', () => {
    cy.login('admin', '/admin/users');
    cy.reload(); // Force a reload
    cy.wait('@getUsers');

    // Find the row for the "Test Mercaderista User"
    cy.contains('td', 'Test Mercaderista User').parent('tr').within(() => {
      // 1. Find the select and change the role to 'supervisor'
      cy.get('.MuiSelect-select').click(); // MUI Select is not a native select
    });

    // The select options are in a popover, so we select from the body
    cy.get('ul[role="listbox"]').contains('li', 'Supervisor').click();

    // 2. The role in the UI should have changed
    cy.contains('td', 'Test Mercaderista User').parent('tr').contains('div', 'supervisor');

    // 3. Click the save button in that row
    cy.contains('td', 'Test Mercaderista User').parent('tr').within(() => {
      cy.contains('button', 'Guardar').click();
    });

    // 4. Wait for the update call to be made
    cy.wait('@updateUser');

    // 5. Verify success message
    cy.contains('Rol de usuario actualizado con éxito').should('be.visible');
  });
});
