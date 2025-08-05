describe('Supervisor Main Workflow', () => {
  // For E2E tests, it's better to have a clean state.
  // We can't easily reset a real DB, but we can ensure our test data is unique.
  const newPointName = `Test Point ${Date.now()}`;
  const newMercaderistaId = `test-mercaderista-${Date.now()}`;

  beforeEach(() => {
    // Log in as a supervisor before each test
    cy.login('supervisor');
  });

  it('should allow a supervisor to create a point of sale and then a route', () => {
    // To test the flow, we'll visit pages directly.

    // 1. Visit Points of Sale page and add a new one
    cy.visit('/puntos-de-venta');
    cy.get('input[id="nombre"]').type(newPointName);
    cy.get('input[id="direccion"]').type('123 Test St');
    cy.get('input[id="ciudad"]').type('Test City');
    cy.contains('button', 'Guardar Punto').click();

    // 2. Verify the new point is in the table
    cy.contains('td', newPointName).should('be.visible');

    // 3. Visit Routes page
    cy.visit('/rutas');

    // 4. Create a new route with the new point of sale
    cy.get('input[id="mercaderistaId"]').type(newMercaderistaId);
    // Find the checkbox corresponding to our new point and check it
    cy.contains('label', newPointName).parent().find('input[type="checkbox"]').check();
    cy.contains('button', 'Guardar Ruta').click();

    // 5. Verify the new route is in the table
    cy.contains('td', newMercaderistaId).should('be.visible');
    cy.contains('td', newPointName).should('be.visible');
  });
});
