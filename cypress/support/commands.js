Cypress.Commands.add('login', (role) => {
  // Establece la única clave que el AuthProvider necesita en modo de prueba.
  // Esto se hace de forma síncrona antes de que la página cargue.
  window.localStorage.setItem('cypress-role', role);
});
