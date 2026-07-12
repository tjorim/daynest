import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth as useOidcAuth } from "react-oidc-context";
import { AuthApiError, fetchMe, type AuthUser } from "@/lib/api/auth";
import { setOidcAccessToken } from "@/lib/auth/session";
import { AUTH_ROUTE_PATHS } from "@/config/oidc";

function getLoginReturnTo() {
  if (AUTH_ROUTE_PATHS.has(window.location.pathname)) {
    return "/today";
  }

  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  sessionError: string | null;
  oidcError: string | null;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const oidc = useOidcAuth();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    setOidcAccessToken(oidc.user?.access_token);
  }, [oidc.user?.access_token]);

  useEffect(() => {
    const accessToken = oidc.user?.access_token;

    if (!oidc.isAuthenticated || !accessToken) {
      setIsFetching(false);
      setUser(null);
      setSessionError(null);
      return;
    }

    let cancelled = false;
    setIsFetching(true);

    fetchMe(accessToken)
      .then((nextUser) => {
        if (!cancelled) {
          setUser(nextUser);
          setSessionError(null);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;

        if (error instanceof AuthApiError && error.status === 401) {
          setUser(null);
          setSessionError(null);
          return;
        }

        setSessionError(error instanceof Error ? error.message : "Unable to load session");
      })
      .finally(() => {
        if (!cancelled) setIsFetching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [oidc.isAuthenticated, oidc.user?.access_token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading: oidc.isLoading || isFetching,
      isAuthenticated: oidc.isAuthenticated && (user !== null || sessionError !== null),
      login: () => {
        void oidc.signinRedirect({ state: { returnTo: getLoginReturnTo() } });
      },
      logout: () => {
        void oidc.signoutRedirect();
      },
      refreshUser: async () => {
        const accessToken = oidc.user?.access_token;
        if (!accessToken) return;
        try {
          const nextUser = await fetchMe(accessToken);
          setUser(nextUser);
          setSessionError(null);
        } catch (error: unknown) {
          if (error instanceof AuthApiError && error.status === 401) {
            setUser(null);
            setSessionError(null);
            return;
          }

          setSessionError(error instanceof Error ? error.message : "Unable to load session");
        }
      },
      sessionError,
      oidcError: oidc.error?.message ?? null,
    }),
    [user, oidc, isFetching, sessionError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
