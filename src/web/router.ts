import { useCallback, useEffect, useState } from "react";

const read = () =>
  decodeURIComponent(window.location.hash.replace(/^#\/?/, "")) || null;

export type Page = "applications" | "setup";

const page = (): Page =>
  window.location.pathname === "/setup" ? "setup" : "applications";

export function usePage() {
  const [current, setCurrent] = useState(page);

  useEffect(() => {
    const sync = () => setCurrent(page());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const go = useCallback((next: Page) => {
    window.history.pushState(null, "", next === "setup" ? "/setup" : "/");
    setCurrent(next);
  }, []);

  return { page: current, go };
}

export function useOpenApplication() {
  const [id, setId] = useState(read);

  useEffect(() => {
    const sync = () => setId(read());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const open = useCallback((next: string) => {
    window.history.pushState({ sheet: true }, "", `#/${next}`);
    setId(next);
  }, []);

  const close = useCallback(() => {
    if (window.history.state?.sheet) return window.history.back();
    window.history.replaceState(null, "", window.location.pathname);
    setId(null);
  }, []);

  return { id, open, close };
}
