describe('Supervisor Main Workflow', () => {
  const newPointName = `Test Point ${Date.now()}`;
  const newMercaderistaId = `test-mercaderista-${Date.now()}`;
  const newPoint = { id: 'pdv-test', nombre: newPointName, direccion: '123 Test St', ciudad: 'Test City' };
  const newRoute = { id: 'ruta-test', mercaderista_id: newMercaderistaId, puntos_de_venta_ids: [newPoint.id], fecha: new Date().toISOString().split('T')[0] };

  beforeEach(() => {
    // Set the role for all tests in this suite
    cy.login('supervisor');
  });

  it('should allow a supervisor to create a point of sale and then a route', () => {
    // --- Part 1: Create a Point of Sale ---
    cy.intercept('GET', '/api/puntos-de-venta*', { body: { data: [], totalCount: 0 } }).as('getPuntosInitial');
    cy.intercept('POST', '/api/puntos-de-venta', { statusCode: 201, body: newPoint }).as('createPunto');

    cy.visit('/puntos-de-venta');
    cy.wait('@getPuntosInitial'); // Wait for the initial fetch
    cy.contains('h4', 'Gestión de Puntos de Venta').should('be.visible');

    cy.get('input[name="nombre"]').type(newPoint.nombre);
    cy.get('input[name="direccion"]').type(newPoint.direccion);
    cy.get('input[name="ciudad"]').type(newPoint.ciudad);
    cy.contains('button', 'Guardar Punto').click();
    cy.wait('@createPunto');
    cy.contains('Punto de venta creado con éxito!').should('be.visible');

    // --- Part 2: Create a Route ---
    cy.intercept('GET', '/api/puntos-de-venta*', { body: { data: [newPoint], totalCount: 1 } }).as('getPuntosForRuta');
    cy.intercept('GET', '/api/rutas*', { body: { data: [], totalCount: 0 } }).as('getRutasInitial');
    cy.intercept('POST', '/api/rutas', { statusCode: 201, body: newRoute }).as('createRuta');

    cy.visit('/rutas');
    cy.wait('@getRutasInitial');
    cy.contains('h4', 'Gestión de Rutas').should('be.visible');

    cy.get('input[name="mercaderistaId"]').type(newMercaderistaId);
    cy.contains('label', newPoint.nombre).parent().find('input[type="checkbox"]').check();
    cy.contains('button', 'Crear Ruta').click();
    cy.wait('@createRuta');
    cy.contains('Ruta creada con éxito').should('be.visible');
  });
});
