const { defineConfig } = require('cypress');
const { createClient } = require('@supabase/supabase-js');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    setupNodeEvents(on, config) {
      on('task', {
        async e2eLogin({ role }) {
          const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_KEY
          );

          const testUserIds = {
            admin: 'a1b2c3d4-e5f6-7890-1234-abcdef123456',
            supervisor: 'b2c3d4e5-f6a7-8901-2345-bcdefa123456',
            mercaderista: 'c3d4e5f6-a7b8-9012-3456-cdefab123456',
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
