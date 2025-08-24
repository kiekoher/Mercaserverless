Cypress.Commands.add('login', (role) => {
  // Set a cookie that the server-side auth middleware can read
  cy.setCookie('cypress-role', role, { httpOnly: false });
  // also set local storage for the client-side AuthProvider
  window.localStorage.setItem('cypress-role', role);
});
