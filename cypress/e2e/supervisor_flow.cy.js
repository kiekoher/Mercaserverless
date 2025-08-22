describe('Supervisor Main Workflow', () => {
  const newPointName = `Test Point ${Date.now()}`;
  const newMercaderistaId = `test-mercaderista-${Date.now()}`;
  const newPoint = { id: 'pdv-test', nombre: newPointName, direccion: '123 Test St', ciudad: 'Test City' };
  const newRoute = { id: 'ruta-test', mercaderista_id: newMercaderistaId, puntos_de_venta_ids: [newPoint.id], fecha: new Date().toISOString().split('T')[0] };

  it('should allow a supervisor to create a point of sale and then a route', () => {
    // --- Mocking for /puntos-de-venta page ---
    cy.intercept('GET', '/api/puntos-de-venta*', { body: [], headers: { 'X-Total-Count': '0' } }).as('getPuntosInitial');
    cy.intercept('POST', '/api/puntos-de-venta', { statusCode: 201, body: newPoint }).as('createPunto');

    // 1. Visit Points of Sale page and add a new one
    cy.login('supervisor', '/puntos-de-venta');
    cy.reload();
    cy.wait('@getPuntosInitial');

    cy.get('input[name="nombre"]').type(newPoint.nombre);
    cy.get('input[name="direccion"]').type(newPoint.direccion);
    cy.get('input[name="ciudad"]').type(newPoint.ciudad);
    cy.contains('button', 'Guardar Punto').click();
    cy.wait('@createPunto');

    // 2. Verify the success message
    cy.contains('Punto de venta creado con éxito!').should('be.visible');

    // --- Mocking for /rutas page ---
    cy.intercept('GET', '/api/puntos-de-venta*', { body: [newPoint], headers: { 'X-Total-Count': '1' } }).as('getPuntosForRuta');
    cy.intercept('GET', '/api/rutas*', { body: [], headers: { 'X-Total-Count': '0' } }).as('getRutasInitial');
    cy.intercept('POST', '/api/rutas', { statusCode: 201, body: newRoute }).as('createRuta');

    // 3. Visit Routes page
    cy.login('supervisor', '/rutas');
    cy.reload();
    cy.wait('@getRutasInitial');
    cy.wait('@getPuntosForRuta');

    // 4. Create a new route with the new point of sale
    cy.get('input[name="mercaderistaId"]').type(newMercaderistaId);
    cy.contains('label', newPoint.nombre).parent().find('input[type="checkbox"]').check();
    cy.contains('button', 'Crear Ruta').click();
    cy.wait('@createRuta');

    // 5. Verify the success message
    cy.contains('Ruta creada con éxito').should('be.visible');
  });
});
