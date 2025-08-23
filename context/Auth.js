import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { getSupabaseClient } from '../lib/supabaseClient';
import logger from '../lib/logger.client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const bypassAuth = process.env.NEXT_PUBLIC_BYPASS_AUTH_FOR_TESTS === 'true';
  const supabase = useMemo(() => {
    if (bypassAuth) return null;
    try {
      return getSupabaseClient();
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        logger.warn({ err: e }, 'Failed to initialize Supabase client');
      }
      return null;
    }
  }, [bypassAuth]);
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null); // New state for profile
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const setupSession = async () => {
      if (bypassAuth) {
        const role =
          window.localStorage.getItem('cypress-role') || 'admin';
        const idMap = {
          admin: process.env.CYPRESS_ADMIN_ID,
          supervisor: process.env.CYPRESS_SUPERVISOR_ID,
          mercaderista: process.env.CYPRESS_MERCADERISTA_ID,
        };
        const id = idMap[role] || 'cypress-user';
        const mockProfile = {
          id,
          role,
          full_name: `Test ${role.charAt(0).toUpperCase() + role.slice(1)}`,
          updated_at: new Date().toISOString(),
        };
        setSession(null);
        setUser({ id });
        setProfile(mockProfile);
        setLoading(false);
        return;
      }
      if (!supabase) {
        setLoading(false);
        return;
      }
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          const { data: userProfile, error } = await supabase
            .from('profiles')
            .select('id, role, full_name, updated_at')
            .eq('id', session.user.id)
            .single();
          if (error) {
            logger.error({ err: error }, 'Error fetching profile');
            await supabase.auth.signOut();
            setProfile(null);
          } else {
            setProfile(userProfile);
          }
        }
      } catch (err) {
        logger.error({ err }, 'Unexpected error loading session');
        await supabase.auth.signOut();
      } finally {
        setLoading(false);
      }
    };

    setupSession();

    if (!supabase) return;
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        try {
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            const { data: userProfile, error } = await supabase
              .from('profiles')
              .select('id, role, full_name, updated_at')
              .eq('id', session.user.id)
              .single();
            if (error) {
              logger.error({ err: error }, 'Error fetching profile');
              await supabase.auth.signOut();
              setProfile(null);
            } else {
              setProfile(userProfile);
            }
          } else {
            setProfile(null); // Clear profile on sign out
          }
        } catch (err) {
          logger.error({ err }, 'Unexpected auth state error');
          await supabase.auth.signOut();
          setProfile(null);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const value = {
    session,
    user,
    profile, // Expose profile
    signOut: () => {
      if (bypassAuth) {
        setSession(null);
        setUser(null);
        setProfile(null);
        return Promise.resolve();
      }
      return supabase?.auth.signOut();
    },
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
