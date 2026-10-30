import { PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";
import {
  Alert,
  AlertAction,
  AlertDescription,
} from "@/web/components/ui/alert";
import { Button } from "@/web/components/ui/button";
import { ApplicationSheet } from "./components/ApplicationSheet";
import { NewApplication } from "./components/NewApplication";
import { useOpenApplication, usePage } from "./router";
import { useApplications } from "./use-applications";
import { Applications } from "./views/Applications";
import { Setup } from "./views/Setup";

export function App() {
  const data = useApplications();
  const sheet = useOpenApplication();
  const { page, go } = usePage();
  const [adding, setAdding] = useState(false);

  return (
    <div className="dark app">
      <header className="topbar">
        <button
          type="button"
          className="brand"
          onClick={() => go("applications")}
        >
          <img src="/favicon.svg" alt="" width={24} height={24} />
          Job Search
        </button>
        <nav className="flex items-center gap-1" aria-label="Main">
          <Button
            variant={page === "applications" ? "secondary" : "ghost"}
            size="sm"
            aria-current={page === "applications" ? "page" : undefined}
            onClick={() => go("applications")}
          >
            Applications
          </Button>
          <Button
            variant={page === "setup" ? "secondary" : "ghost"}
            size="sm"
            aria-current={page === "setup" ? "page" : undefined}
            onClick={() => go("setup")}
          >
            Setup
          </Button>
          <Button
            size="sm"
            className="ml-1"
            aria-label="Add job"
            onClick={() => setAdding(true)}
          >
            <PlusIcon />
            <span className="hidden sm:inline">Add job</span>
          </Button>
        </nav>
      </header>

      <main className="shell">
        {data.error && (
          <Alert variant="destructive" className="mb-4">
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
        {page === "setup" ? (
          <Setup />
        ) : (
          <Applications
            data={data}
            onOpen={sheet.open}
            onNew={() => setAdding(true)}
            onSetup={() => go("setup")}
          />
        )}
      </main>

      {adding && (
        <NewApplication
          onClose={() => setAdding(false)}
          onCreated={async (id) => {
            setAdding(false);
            go("applications");
            await data.refresh();
            sheet.open(id);
          }}
        />
      )}
      {sheet.id && (
        <ApplicationSheet
          key={sheet.id}
          id={sheet.id}
          onClose={sheet.close}
          onChanged={data.refresh}
        />
      )}
    </div>
  );
}
