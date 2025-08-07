Cypress.Commands.add('login', (role) => {
  cy.task('e2eLogin', { role }).then((session) => {
    if (!session) {
      throw new Error('Failed to obtain test session');
    }
    const supabaseLocalStorageKey = `sb-qaceecznfveabbnpteox-auth-token`;
    window.localStorage.setItem(supabaseLocalStorageKey, JSON.stringify(session));
  });
});

