import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./AuthContext";

/**
 * BranchContext — single source of truth for the user's branches and which one
 * is currently selected. Used by Topbar (branch switcher), Queue, IslamicBar,
 * Settings, Manager — anywhere that needs "the current branch."
 *
 * Loads branches the user OWNS or is STAFF at. Persists selection in localStorage
 * so the user lands on the same branch after a refresh.
 *
 * Gracefully handles "DB not migrated yet" — exposes `dbReady=false` so callers
 * can render a setup card instead of crashing.
 */
const BranchContext = createContext(null);

const STORAGE_KEY = "azq.currentBranchId";

export function BranchProvider({ children }) {
  const { user } = useAuth();

  const [branches, setBranches]   = useState([]);
  const [currentId, setCurrentId] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  });
  const [loading, setLoading]     = useState(true);
  const [dbReady, setDbReady]     = useState(true);

  // Load all branches this user can see (owned + staff-linked, via RLS)
  const reload = useCallback(async () => {
    if (!user) { setBranches([]); setLoading(false); return; }
    setLoading(true);

    const { data, error } = await supabase
      .from("branches")
      .select("*")
      .order("created_at", { ascending: true });

    if (error && /relation .* does not exist|table .* not found/i.test(error.message || "")) {
      setDbReady(false);
      setBranches([]);
      setLoading(false);
      return;
    }

    setDbReady(true);
    setBranches(data ?? []);
    setLoading(false);

    // If our remembered branch isn't in the list (e.g. deleted), fall back to first
    if (data?.length) {
      const exists = currentId && data.some((b) => b.id === currentId);
      if (!exists) {
        setCurrentId(data[0].id);
        try { localStorage.setItem(STORAGE_KEY, data[0].id); } catch {}
      }
    } else {
      setCurrentId(null);
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
    }
  }, [user?.id]);

  useEffect(() => { reload(); }, [reload]);

  // Realtime: keep branch list fresh if owner adds/edits a branch in another tab
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`user-${user.id}-branches`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "branches" },
        () => reload()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, reload]);

  const select = useCallback((id) => {
    setCurrentId(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch {}
  }, []);

  const currentBranch = branches.find((b) => b.id === currentId) ?? branches[0] ?? null;

  return (
    <BranchContext.Provider value={{
      branches,
      currentBranch,
      currentId: currentBranch?.id ?? null,
      select,
      loading,
      dbReady,
      reload,
    }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error("useBranch must be used inside <BranchProvider>");
  return {
    branch: ctx.currentBranch,
    branches: ctx.branches,
    select: ctx.select,
    loading: ctx.loading,
    dbReady: ctx.dbReady,
    reload: ctx.reload,
  };
}
