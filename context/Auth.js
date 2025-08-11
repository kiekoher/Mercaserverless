import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { getSupabaseClient } from '../lib/supabaseClient';
import logger from '../lib/logger';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const supabase = useMemo(() => {
    try {
      return getSupabaseClient();
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(e.message);
      }
      return null;
    }
  }, []);
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null); // New state for profile
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const setupSession = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          const { data: userProfile, error } = await supabase
            .from('profiles')
            .select('*')
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
              .select('*')
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
    signOut: () => supabase?.auth.signOut(),
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
