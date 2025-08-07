import { createClient } from '@supabase/supabase-js';

// This API route is for E2E testing only and should not be exposed in production.
// Ensure it is excluded from production builds.
export default async function handler(req, res) {
  if (
    process.env.NODE_ENV !== 'test' ||
    process.env.ENABLE_E2E_LOGIN !== 'true'
  ) {
    return res.status(404).json({ error: 'Not found' });
  }

  const { role } = req.body;
  if (!role) {
    return res.status(400).json({ error: 'Role is required' });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // In a real scenario, you would have dedicated test users.
  // Here, we'll map roles to pre-defined test user UUIDs.
  // These UUIDs must exist in your Supabase auth.users table.
  const testUserIds = {
    admin: 'a1b2c3d4-e5f6-7890-1234-abcdef123456', // Replace with a real test user ID
    supervisor: 'b2c3d4e5-f6a7-8901-2345-bcdefa123456', // Replace with a real test user ID
    mercaderista: 'c3d4e5f6-a7b8-9012-3456-cdefab123456', // Replace with a real test user ID
  };

  const userId = testUserIds[role];
  if (!userId) {
    return res.status(400).json({ error: 'Invalid role specified' });
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: `test-${role}@example.com`, // The email for the user ID
    });

    if (error) throw error;

    // The link contains the access_token we need.
    const url = new URL(data.properties.action_link);
    const accessToken = url.searchParams.get('token');

    // We also need the user object to set it correctly
    const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId);

    // The session object that Supabase client expects
    const session = {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'dummy-refresh-token-for-e2e', // A dummy token is fine here
      user,
    };

    res.status(200).json({ session });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate test session', details: error.message });
  }
}
