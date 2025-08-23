const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    env: {
      adminId: process.env.CYPRESS_ADMIN_ID,
      supervisorId: process.env.CYPRESS_SUPERVISOR_ID,
      mercaderistaId: process.env.CYPRESS_MERCADERISTA_ID,
      supabaseProjectId: 'e2e-project-id-for-local-testing',
    },
    setupNodeEvents(on, config) {
      on('task', {
        async e2eLogin({ role }) {
          // This is a mock implementation to avoid dependency on a live Supabase instance
          // for CI/CD environments. It returns a valid-looking session object.

          const testUserIds = {
            admin: config.env.adminId,
            supervisor: config.env.supervisorId,
            mercaderista: config.env.mercaderistaId,
          };

          const userId = testUserIds[role];
          if (!userId) {
            console.error(`Cypress e2eLogin task: No user ID found for role: ${role}`);
            return null;
          }

          const mockUser = {
            id: userId,
            email: `test-${role}@example.com`,
            role: 'authenticated',
            app_metadata: {
              provider: 'email',
              providers: ['email'],
              role: role,
            },
            user_metadata: {
              name: `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`,
            },
            aud: 'authenticated',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          return {
            access_token: `mock-access-token-for-${role}`,
            token_type: 'bearer',
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            refresh_token: `mock-refresh-token-for-${role}`,
            user: mockUser,
          };
        }
      });
    },
  },
});
