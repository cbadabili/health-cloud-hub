import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Database } from "@/integrations/supabase/types";

export type PracticeRole = Database["public"]["Enums"]["practice_role"];
export type PracticeSummary = Database["public"]["Functions"]["my_practices"]["Returns"][number];

interface PracticeContextValue {
  /** Practices the signed-in user is an active member of. */
  practices: PracticeSummary[];
  /** The practice currently being worked in. */
  current: PracticeSummary | null;
  setCurrentId: (practiceId: string) => void;
  loading: boolean;
  /** True when the tenancy migration hasn't been applied to the database yet. */
  notSetUp: boolean;
  refresh: () => Promise<void>;
  /** Does the user hold any of these roles in the current practice? */
  hasRole: (...roles: PracticeRole[]) => boolean;
}

const PracticeContext = createContext<PracticeContextValue | undefined>(undefined);
const STORAGE_KEY = "clinithetics.currentPractice";

const readStoredId = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

/** PostgREST "function not found": the tenancy migration isn't applied yet. */
const isFunctionMissing = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === "PGRST202" || error.code === "42883" || /Could not find the function/i.test(error.message ?? ""));

export const PracticeProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [practices, setPractices] = useState<PracticeSummary[]>([]);
  const [currentId, setCurrentIdState] = useState<string | null>(readStoredId);
  const [loading, setLoading] = useState(true);
  const [notSetUp, setNotSetUp] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setPractices([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc("my_practices");
    if (error) {
      setNotSetUp(isFunctionMissing(error));
      if (!isFunctionMissing(error)) console.error("Could not load practices:", error.message);
      setPractices([]);
    } else {
      setNotSetUp(false);
      setPractices(data ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading) refresh();
  }, [authLoading, refresh]);

  const setCurrentId = useCallback((practiceId: string) => {
    setCurrentIdState(practiceId);
    try {
      localStorage.setItem(STORAGE_KEY, practiceId);
    } catch {
      // Remembering the choice is a convenience only.
    }
  }, []);

  const current = useMemo(
    () => practices.find((p) => p.practice_id === currentId) ?? practices[0] ?? null,
    [practices, currentId],
  );

  const hasRole = useCallback(
    (...roles: PracticeRole[]) => !!current && current.roles.some((r) => roles.includes(r)),
    [current],
  );

  const value = useMemo(
    () => ({ practices, current, setCurrentId, loading: loading || authLoading, notSetUp, refresh, hasRole }),
    [practices, current, setCurrentId, loading, authLoading, notSetUp, refresh, hasRole],
  );

  return <PracticeContext.Provider value={value}>{children}</PracticeContext.Provider>;
};

export const usePractice = () => {
  const ctx = useContext(PracticeContext);
  if (!ctx) throw new Error("usePractice must be used inside PracticeProvider");
  return ctx;
};
