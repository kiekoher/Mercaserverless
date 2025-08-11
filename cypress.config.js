const { defineConfig } = require('cypress');
const { createClient } = require('@supabase/supabase-js');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    env: {
      adminId: process.env.CYPRESS_ADMIN_ID,
      supervisorId: process.env.CYPRESS_SUPERVISOR_ID,
      mercaderistaId: process.env.CYPRESS_MERCADERISTA_ID,
    },
    setupNodeEvents(on, config) {
      on('task', {
        async e2eLogin({ role }) {
          const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
          );

          const testUserIds = {
            admin: config.env.adminId,
            supervisor: config.env.supervisorId,
            mercaderista: config.env.mercaderistaId,
          };

          const userId = testUserIds[role];
          if (!userId) return null;

          const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email: `test-${role}@example.com`,
          });
          if (error) throw error;

          const url = new URL(data.properties.action_link);
          const accessToken = url.searchParams.get('token');

          const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId);

          return {
            access_token: accessToken,
            token_type: 'bearer',
            expires_in: 3600,
            refresh_token: 'dummy-refresh-token-for-e2e',
            user,
          };
        }
      });
    },
  },
});
