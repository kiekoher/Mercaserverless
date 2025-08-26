// ***********************************************************
// This example support/e2e.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands.js'

// Fetch the CSRF token once before any tests run
before(() => {
  cy.request('/api/csrf').then((response) => {
    Cypress.env('csrfToken', response.body.csrfToken);
  });
});

// Alternatively, you can use CommonJS syntax:
// require('./commands')

Cypress.on('window:before:load', (win) => {
  // Inject the CSRF token into the window so the app can pick it up
  win.__CSRF_TOKEN__ = Cypress.env('csrfToken');

  const origFetch = win.fetch.bind(win);
  cy.stub(win, 'fetch')
    .callsFake((...args) => {
      const [resource] = args;
      if (typeof resource === 'string' && resource.endsWith('/api/csrf')) {
        throw new Error('Unexpected CSRF fetch during Cypress tests');
      }
      return origFetch(...args);
    })
    .as('fetch');
});
