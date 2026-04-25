import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  fetchMe,
  login as loginRequest,
  logout as clearSession,
  refreshSessionTokens,
  register as registerRequest,
  type AuthUser,
} from '../../lib/api/auth';
import { getStoredTokens, storeTokens } from '../../lib/auth/session';

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function hydrateUser() {
  const tokens = getStoredTokens();

  if (!tokens) {
    return null;
  }

  try {
    return await fetchMe(tokens.accessToken);
  } catch (error) {
    const refreshed = await refreshSessionTokens();
    if (!refreshed) {
      return null;
    }
    storeTokens(refreshed);
    return fetchMe(refreshed.accessToken);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    const nextUser = await hydrateUser();
    setUser(nextUser);
  };

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const nextUser = await hydrateUser();
        if (isMounted) {
          setUser(nextUser);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: Boolean(user),
      login: async (email: string, password: string) => {
        const tokens = await loginRequest({ email, password });
        const nextUser = await fetchMe(tokens.accessToken);
        setUser(nextUser);
      },
      register: async (fullName: string, email: string, password: string) => {
        const tokens = await registerRequest({ full_name: fullName, email, password });
        const nextUser = await fetchMe(tokens.accessToken);
        setUser(nextUser);
      },
      logout: () => {
        clearSession();
        setUser(null);
      },
      refreshUser: async () => {
        const nextUser = await hydrateUser();
        setUser(nextUser);
      },
    }),
    [isLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
