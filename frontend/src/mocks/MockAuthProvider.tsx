import { useEffect } from "react";
import { AuthContext } from "@/app/providers/AuthProvider";
import { setOidcAccessToken } from "@/lib/auth/session";
import { MOCK_TOKEN, MOCK_USER } from "./data/constants";
import { getMockState } from "./data/state";

export function MockAuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    setOidcAccessToken(MOCK_TOKEN);
    return () => {
      setOidcAccessToken(undefined);
    };
  }, []);

  const { scenario } = getMockState();
  const isAuthenticated = scenario !== "signed-out" && scenario !== "expired-session";

  return (
    <AuthContext.Provider
      value={{
        user: isAuthenticated ? MOCK_USER : null,
        isLoading: false,
        isAuthenticated,
        login: () => {},
        logout: () => {},
        refreshUser: async () => {},
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
