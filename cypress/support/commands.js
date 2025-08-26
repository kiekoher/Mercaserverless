Cypress.Commands.add('login', (role) => {
  // Set a cookie that the server-side auth middleware can read
  cy.setCookie('cypress-role', role, { httpOnly: false });
  // Ensure the CSRF secret cookie matches the token used by the app
  const csrfToken = Cypress.env('csrfToken');
  if (csrfToken) {
    cy.setCookie('csrf-secret', csrfToken);
  }
  // also set local storage for the client-side AuthProvider
  window.localStorage.setItem('cypress-role', role);
});
