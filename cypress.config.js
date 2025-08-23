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
      // No tasks needed for this simplified approach
    },
  },
});
