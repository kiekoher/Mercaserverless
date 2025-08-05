describe('Admin User Management Workflow', () => {
  beforeEach(() => {
    // Log in as an admin before each test
    cy.login('admin');
  });

  it('should allow an admin to visit the user management page and see the user list', () => {
    // 1. Visit the admin users page
    cy.visit('/admin/users');

    // 2. Verify the main components of the page are visible
    cy.contains('h4', 'Gestión de Usuarios').should('be.visible');

    // 3. Verify the table headers are present
    cy.contains('th', 'Email').should('be.visible');
    cy.contains('th', 'Rol').should('be.visible');
    cy.contains('th', 'Acciones').should('be.visible');

    // 4. We can't guarantee specific users exist, but we can check that the table body exists,
    // which implies the data fetching logic has run.
    cy.get('table > tbody').should('exist');
  });

  it('should allow an admin to change a user role', () => {
    cy.visit('/admin/users');

    // This test is more fragile as it depends on finding a user with a specific role
    // that is not 'admin'. A better setup would involve seeding a test user.
    // For now, we find the first user row that doesn't contain the text 'admin'.
    cy.get('tbody > tr').contains('td', 'mercaderista').first().parent('tr').within(() => {
      // 1. Find the select and change the role to 'supervisor'
      cy.get('div[role="button"]').click(); // MUI Select is not a native select
    });
    // The select options are in a popover, so we select from the body
    cy.get('ul[role="listbox"]').contains('li', 'Supervisor').click();

    // 2. The value should have changed in the UI
    cy.get('tbody > tr').contains('td', 'mercaderista').should('not.exist'); // The original role should be gone
    cy.get('tbody > tr').contains('td', 'supervisor').first().parent('tr').within(() => {
        // 3. Click the save button in that row
        cy.contains('button', 'Guardar').click();
    });

    // 4. Verify success message
    cy.contains('Rol de usuario actualizado con éxito').should('be.visible');

    // 5. To ensure persistence, we can reload the page and check again
    cy.reload();
    cy.get('tbody > tr').contains('td', 'supervisor').should('be.visible');
  });
});
