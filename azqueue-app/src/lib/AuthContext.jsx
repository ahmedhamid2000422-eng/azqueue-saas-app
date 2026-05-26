import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Read whatever session is in localStorage (if any)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 2. Subscribe to login / logout / token-refresh events
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    signUp: async ({ email, password, mode = "business", businessName, tier, displayName }) => {
      const meta = { mode };
      if (mode === "business") {
        meta.business_name = businessName;
        meta.tier = tier ?? "professional";
      } else {
        meta.display_name = displayName ?? null;
      }
      // IMPORTANT: pin the email-confirmation link to the current deployed origin.
      // Without this, Supabase falls back to its dashboard "Site URL" which is
      // often still http://localhost:3000 — causing the link in the email (and
      // any subsequent /auth/v1/* fetch) to land on the wrong host in production.
      const origin = typeof window !== "undefined"
        ? window.location.origin
        : (import.meta.env.VITE_SITE_URL ?? "https://azqueue.io");

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: meta,
          emailRedirectTo: `${origin}/login`,
        },
      });
      return { data, error };
    },
    signIn: async ({ email, password }) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { data, error };
    },
    sendPasswordReset: async (email) => {
      const origin = typeof window !== "undefined"
        ? window.location.origin
        : (import.meta.env.VITE_SITE_URL ?? "https://azqueue.io");
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/login`,
      });
      return { error };
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut();
      return { error };
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Returns "business" | "personal" — defaults to "business" for legacy signups. */
export function userMode(user) {
  return user?.user_metadata?.mode ?? "business";
}