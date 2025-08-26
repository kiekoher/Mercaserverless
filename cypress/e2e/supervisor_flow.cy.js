describe('Supervisor Main Workflow', () => {
  const newPointName = `Test Point ${Date.now()}`;
  const newMercaderistaId = `test-mercaderista-${Date.now()}`;
  const newPoint = { id: 1, nombre: newPointName, direccion: '123 Test St', ciudad: 'Test City' };
  // Mock de la ruta con la nueva estructura que devuelve la API
  const newRouteApiResponse = {
    id: 1,
    fecha: new Date().toISOString().split('T')[0],
    mercaderista_id: newMercaderistaId,
    mercaderista_name: 'Test Mercaderista',
    puntos_de_venta: [newPoint]
  };
  // Mock de la respuesta del RPC, que es más simple
  const newRouteRpcResponse = [{
    id: 1,
    fecha: newRouteApiResponse.fecha,
    mercaderista_id: newMercaderistaId
  }];


  beforeEach(() => {
    // Set the role for all tests in this suite
    cy.login('supervisor');
  });

  it('should allow a supervisor to create a point of sale and then a route', () => {
    // This test simulates the entire workflow for a supervisor.
    // It uses cy.intercept() to mock API responses, ensuring the test is fast and reliable
    // without depending on a live backend state.

    // --- Part 1: Create a Point of Sale ---
    // Mock the initial GET request to show an empty list of points.
    cy.intercept('GET', '/api/puntos-de-venta*', {
      statusCode: 200,
      body: { data: [], totalCount: 0 },
    }).as('getPuntosInitial');

    // Mock the POST request to simulate a successful creation.
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
    // La API POST ahora devuelve la respuesta del RPC
    cy.intercept('POST', '/api/rutas', { statusCode: 201, body: newRouteRpcResponse }).as('createRuta');

    // Después de crear, la página pide las rutas de nuevo. Devolvemos la ruta con la estructura completa.
    cy.intercept('GET', '/api/rutas*', { body: { data: [newRouteApiResponse], totalCount: 1 } }).as('getRutasAfterCreate');


    cy.visit('/rutas');
    cy.wait('@getRutasInitial');
    cy.contains('h4', 'Gestión y Seguimiento de Rutas').should('be.visible');

    // Fill the form to create a new route
    cy.get('input[name="mercaderistaId"]').type(newMercaderistaId);
    cy.contains('label', newPoint.nombre).parent().find('input[type="checkbox"]').check();
    cy.contains('button', 'Crear Ruta').click();
    cy.wait('@createRuta');
    cy.contains('Ruta creada con éxito').should('be.visible');
  });
});
