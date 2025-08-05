Cypress.Commands.add('login', (role) => {
  cy.request('POST', '/api/e2e-login', { role })
    .its('body.session')
    .then((session) => {
      // The key format is sb-<project-ref>-auth-token
      const supabaseLocalStorageKey = `sb-qaceecznfveabbnpteox-auth-token`;
      window.localStorage.setItem(
        supabaseLocalStorageKey,
        JSON.stringify(session)
      );
    });
});
