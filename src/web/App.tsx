import { PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";
import {
  Alert,
  AlertAction,
  AlertDescription,
} from "@/web/components/ui/alert";
import { Button } from "@/web/components/ui/button";
import { ApplicationDialog } from "./components/ApplicationDialog";
import { navigate, useRoute, type Route } from "./router";
import { useApplications } from "./use-applications";
import { Applications } from "./views/Applications";
import { Dashboard } from "./views/Dashboard";

const NAV: Array<{ route: Route; label: string }> = [
  { route: "dashboard", label: "Dashboard" },
  { route: "applications", label: "Applications" },
];

export function App() {
  const data = useApplications();
  const route = useRoute();
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="dark app">
      <header className="topbar">
        <button
          type="button"
          className="brand"
          onClick={() => navigate("dashboard")}
        >
          <img src="/favicon.svg" alt="" width={22} height={22} />
          Job Search
        </button>
        <nav className="nav" aria-label="Sections">
          {NAV.map((item) => (
            <button
              key={item.route}
              type="button"
              className={item.route === route ? "is-current" : ""}
              aria-current={item.route === route ? "page" : undefined}
              onClick={() => navigate(item.route)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="topbar-actions">
          <Button size="sm" onClick={() => setOpen("new")}>
            <PlusIcon /> New
          </Button>
        </div>
      </header>

      <main className="shell">
        {data.error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{data.error}</AlertDescription>
            <AlertAction>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Dismiss error"
                onClick={() => data.setError(null)}
              >
                <XIcon />
              </Button>
            </AlertAction>
          </Alert>
        )}
        {route === "dashboard" && (
          <Dashboard
            data={data}
            onOpen={setOpen}
            onNew={() => setOpen("new")}
          />
        )}
        {route === "applications" && (
          <Applications data={data} onOpen={setOpen} />
        )}
      </main>

      {open && (
        <ApplicationDialog
          key={open}
          id={open}
          onClose={() => setOpen(null)}
          onChanged={data.refresh}
        />
      )}
    </div>
  );
}
