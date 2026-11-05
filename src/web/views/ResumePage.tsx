import { useCallback, useState } from "react";
import type { Resume } from "@/web/api";
import { AtsScanCard } from "@/web/components/AtsScanCard";
import { MatchScoresCard } from "@/web/components/MatchScoresCard";
import { ResumeCard } from "@/web/components/ResumeCard";

export function ResumePage() {
  const [version, setVersion] = useState<string | null>(null);
  const onResume = useCallback(
    (resume: Resume | null) => setVersion(resume?.updatedAt ?? null),
    [],
  );
  return (
    <div className="home max-w-3xl">
      <header className="page-heading">
        <h1>Resume</h1>
      </header>
      <ResumeCard onResume={onResume} />
      <AtsScanCard version={version} />
      <MatchScoresCard />
    </div>
  );
}
