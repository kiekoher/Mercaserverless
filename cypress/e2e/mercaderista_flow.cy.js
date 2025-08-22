describe('Mercaderista Main Workflow', () => {
  beforeEach(() => {
    // Intercept API calls to provide mock data for the route
    cy.intercept('GET', '/api/mi-ruta', { fixture: 'mi-ruta.json' }).as('getMiRuta');
    cy.intercept('GET', '/api/visitas?ruta_id=ruta-123', { fixture: 'visitas.json' }).as('getVisitas');
  });

  it('should allow a mercaderista to visit their route page and see their points of sale', () => {
    // 1. Log in and visit the "Mi Ruta" page
    cy.login('mercaderista', '/mi-ruta');
    cy.reload();

    // 2. Wait for API calls to complete
    cy.wait(['@getMiRuta', '@getVisitas']);

    // 3. Verify the main title is visible
    cy.contains('h4', 'Tu Ruta para Hoy').should('be.visible');

    // 4. Check that the points of sale from the fixture are rendered
    cy.contains('h6', 'Supermercado La Esquina').should('be.visible');
    cy.contains('p', 'Calle Falsa 123, Bogotá').should('be.visible');
    cy.contains('h6', 'Tienda El Ahorro').should('be.visible');
    cy.contains('p', 'Avenida Siempre Viva 456, Medellín').should('be.visible');

    // 5. Check the status of the visits
    // The first point should be "En Progreso" and have a "Check-out" button
    cy.contains('h6', 'Supermercado La Esquina').closest('li').within(() => {
      cy.contains('button', 'Check-out').should('be.visible');
    });

    // The second point should be "Pendiente" and have a "Check-in" button
    cy.contains('h6', 'Tienda El Ahorro').closest('li').within(() => {
      cy.contains('button', 'Check-in').should('be.visible');
    });
  });
});
