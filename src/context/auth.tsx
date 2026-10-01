import { createContext, useContext, createSignal, createMemo, type ParentComponent, type Accessor } from "solid-js";
import { query, createAsync } from "@solidjs/router";
import { toast } from "solid-sonner";
import { fetchServerQuotaData } from "~/lib/quota";
import type { UserSession, QuotaData } from "~/types/quota";

export interface AuthContextType {
  userSession: Accessor<UserSession | null>;
  isSessionLoading: Accessor<boolean>;
  isAuthenticated: Accessor<boolean>;
  loginGoogle: () => void;
  logout: () => Promise<void>;
  setUserSession: (session: UserSession | null) => void;
  setIsSessionLoading: (loading: boolean) => void;
  refreshSession: () => Promise<void>;
}

const getInitialAuthSession = query(async () => {
  return await fetchServerQuotaData();
}, "auth-session-state");

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: ParentComponent = (props) => {
  // Server-rendered initial quota data (SSR + client hydration)
  const initialQuota = createAsync(() => getInitialAuthSession());

  // Client override signal (used when logging in, logging out, or manually modifying session)
  const [clientSession, setClientSession] = createSignal<UserSession | null | undefined>(undefined);
  const [isLoading, setIsLoading] = createSignal<boolean>(false);

  // Single source of truth for user session
  const userSession = createMemo((): UserSession | null => {
    if (clientSession() !== undefined) {
      return clientSession() ?? null;
    }

    const user = initialQuota()?.user;
    if (!user) return null;
    return {
      email: user.email,
      name: user.name,
      picture: user.picture,
    };
  });

  const isAuthenticated = createMemo((): boolean => {
    return Boolean(userSession()?.email);
  });

  const loginGoogle = () => {
    window.location.href = "/api/auth/google";
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/auth/logout", { method: "POST" });

      if (!res.ok) {
        throw new Error(`Sign out failed with status ${res.status}`);
      }

      setClientSession(null);
      toast.success("Signed out successfully", {
        description: "Your Google session has been terminated and session cookies have been cleared.",
      });
    } catch (err: any) {
      console.error("Sign out error:", err);
      toast.error("Sign out encountered an error", {
        description: err?.message || "Unable to complete sign out with the server. Please clear your browser cookies if the session persists.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSession = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/quota");
      if (res.ok) {
        const data: QuotaData = await res.json();

        if (data?.user) {
          setClientSession({
            email: data.user.email,
            name: data.user.name,
            picture: data.user.picture,
          });
        } else {
          setClientSession(null);
        }
      }
    } catch (err) {
      console.error("Failed to refresh session:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const contextValue: AuthContextType = {
    userSession,
    isSessionLoading: isLoading,
    isAuthenticated,
    loginGoogle,
    logout,
    setUserSession: setClientSession,
    setIsSessionLoading: setIsLoading,
    refreshSession,
  };

  return <AuthContext.Provider value={contextValue}>{props.children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    // Return safe fallback in case a component is rendered without provider during tests
    return {
      userSession: () => null,
      isSessionLoading: () => false,
      isAuthenticated: () => false,
      loginGoogle: () => {
        window.location.href = "/api/auth/google";
      },
      logout: async () => {},
      setUserSession: () => {},
      setIsSessionLoading: () => {},
      refreshSession: async () => {},
    };
  }

  return context;
}
