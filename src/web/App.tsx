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
import { useOpenApplication } from "./router";
import { useApplications } from "./use-applications";
import { Applications } from "./views/Applications";

export function App() {
  const data = useApplications();
  const sheet = useOpenApplication();
  const [adding, setAdding] = useState(false);

  return (
    <div className="dark app">
      <header className="topbar">
        <span className="brand">
          <img src="/favicon.svg" alt="" width={24} height={24} />
          Job Search
        </span>
        <Button size="sm" onClick={() => setAdding(true)}>
          <PlusIcon /> Add job
        </Button>
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
        <Applications
          data={data}
          onOpen={sheet.open}
          onNew={() => setAdding(true)}
        />
      </main>

      {adding && (
        <NewApplication
          onClose={() => setAdding(false)}
          onCreated={async (id) => {
            setAdding(false);
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
