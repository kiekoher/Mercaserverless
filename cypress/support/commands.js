Cypress.Commands.add('login', (role, url) => {
  // Use cy.visit's onBeforeLoad callback to set localStorage on the correct origin
  // before any of the app's code runs. This prevents race conditions.
  cy.visit(url, {
    onBeforeLoad(win) {
      win.localStorage.setItem('cypress-role', role);
    },
  });
});

