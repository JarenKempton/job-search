import {
  BriefcaseIcon,
  FileTextIcon,
  PlugIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import {
  Alert,
  AlertAction,
  AlertDescription,
} from "@/web/components/ui/alert";
import { Button } from "@/web/components/ui/button";
import { ApplicationSheet } from "./components/ApplicationSheet";
import { NewApplication } from "./components/NewApplication";
import { useOpenApplication, usePage, type Page } from "./router";
import { useApplications } from "./use-applications";
import { Applications } from "./views/Applications";
import { Connect } from "./views/Connect";
import { ResumePage } from "./views/ResumePage";

const PAGES: { page: Page; label: string; Icon: typeof PlusIcon }[] = [
  { page: "applications", label: "Applications", Icon: BriefcaseIcon },
  { page: "resume", label: "Resume", Icon: FileTextIcon },
  { page: "connect", label: "Connect", Icon: PlugIcon },
];

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
          aria-label="Job Search"
          onClick={() => go("applications")}
        >
          <img src="/favicon.svg" alt="" width={24} height={24} />
          <span>Job Search</span>
        </button>
        <nav
          className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-3 gap-1 border-t bg-background px-(--gutter) pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] sm:static sm:ml-8 sm:flex sm:border-0 sm:p-0"
          aria-label="Main"
        >
          {PAGES.map(({ page: item, label, Icon }) => (
            <Button
              key={item}
              variant={page === item ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "max-sm:h-auto max-sm:flex-col max-sm:gap-0.5 max-sm:py-1.5 max-sm:text-[11px]",
                page !== item && "text-muted-foreground",
              )}
              aria-current={page === item ? "page" : undefined}
              onClick={() => go(item)}
            >
              <Icon />
              {label}
            </Button>
          ))}
        </nav>
        <Button
          size="sm"
          className="sm:ml-auto"
          aria-label="Add job"
          onClick={() => setAdding(true)}
        >
          <PlusIcon />
          Add job
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
        {page === "resume" ? (
          <ResumePage />
        ) : page === "connect" ? (
          <Connect />
        ) : (
          <Applications
            data={data}
            onOpen={sheet.open}
            onNew={() => setAdding(true)}
            onGo={go}
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
