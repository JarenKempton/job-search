import { useCallback, useEffect, useState } from "react";
import { jobs, type Application } from "./api";
import { watchChanges } from "./live";

export const REFRESH_EVERY_MS = 60_000;

export function useApplications() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setApplications(await jobs.list());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const whenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = window.setInterval(whenVisible, REFRESH_EVERY_MS);
    window.addEventListener("focus", whenVisible);
    document.addEventListener("visibilitychange", whenVisible);
    const stopWatching = watchChanges(() => void refresh());
    return () => {
      stopWatching();
      window.clearInterval(timer);
      window.removeEventListener("focus", whenVisible);
      document.removeEventListener("visibilitychange", whenVisible);
    };
  }, [refresh]);

  return { applications, loading, error, setError, refresh };
}

export type ApplicationsData = ReturnType<typeof useApplications>;
