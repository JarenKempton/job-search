import { useEffect, useState } from "react";

export type Route = "dashboard" | "applications";

function read(): Route {
  return window.location.hash.replace(/^#\/?/, "") === "applications"
    ? "applications"
    : "dashboard";
}

export function navigate(route: Route): void {
  window.location.hash = route === "dashboard" ? "" : `/${route}`;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
