Cypress.Commands.add('login', (role) => {
  cy.task('e2eLogin', { role }).then((session) => {
    if (!session) {
      throw new Error('Failed to obtain test session');
    }
    const supabaseProjectId = Cypress.env('supabaseProjectId');
    if (!supabaseProjectId) {
      throw new Error('Cypress.env.supabaseProjectId is not set');
    }
    const supabaseLocalStorageKey = `sb-${supabaseProjectId}-auth-token`;
    window.localStorage.setItem(supabaseLocalStorageKey, JSON.stringify(session));
    window.localStorage.setItem('cypress-role', role);
  });
});

