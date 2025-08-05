describe('Mercaderista Main Workflow', () => {
  beforeEach(() => {
    // Log in as a mercaderista before each test
    cy.login('mercaderista');
  });

  it('should allow a mercaderista to visit their route page', () => {
    // 1. Visit the "Mi Ruta" page
    cy.visit('/mi-ruta');

    // 2. Verify the main title is visible
    cy.contains('h4', 'Mi Ruta Asignada').should('be.visible');

    // 3. The most likely state for a random test run is that no route is assigned.
    // We can check for the message that informs the user about this.
    cy.contains('No tienes una ruta asignada para hoy').should('be.visible');
  });
});
