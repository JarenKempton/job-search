import {
  CheckIcon,
  CircleHelpIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import { matchRating } from "@/applications/fields";
import type { Application } from "@/web/api";
import { Badge } from "@/web/components/ui/badge";
import { Progress } from "@/web/components/ui/progress";

type Details = NonNullable<Application["fitDetails"]>;

const PARTS: Array<{ key: keyof Details; title: string }> = [
  { key: "skills", title: "Skills" },
  { key: "experience", title: "Experience" },
  { key: "domain", title: "Related work" },
  { key: "meetsHardRequirements", title: "Hard requirements" },
];

const GROUPS: Array<{
  key: "met" | "missing" | "unclear";
  title: string;
  icon: LucideIcon;
}> = [
  { key: "met", title: "Meets", icon: CheckIcon },
  { key: "missing", title: "Missing", icon: XIcon },
  { key: "unclear", title: "Unclear", icon: CircleHelpIcon },
];

export function MatchBreakdown({
  fit,
  details,
}: {
  fit: number;
  details: Details | null;
}) {
  const groups = GROUPS.filter(({ key }) => details?.[key]?.length);
  return (
    <section aria-label="Resume match" className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">Resume match</h3>
        <p className="tabular flex items-center gap-2">
          <span className="text-lg font-semibold">{fit}%</span>
          <Badge variant="secondary">{matchRating(fit)}</Badge>
        </p>
      </div>
      {!details && (
        <>
          <Progress value={fit} aria-label="Resume match" />
          <p className="text-xs text-muted-foreground">
            Entered by hand. Score it with your AI for a breakdown.
          </p>
        </>
      )}
      {details && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {PARTS.map(({ key, title }) => (
            <div key={key} className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <dt className="text-muted-foreground">{title}</dt>
                <dd className="tabular font-medium">
                  {details[key] as number}
                </dd>
              </div>
              <Progress value={details[key] as number} aria-label={title} />
            </div>
          ))}
        </dl>
      )}
      {details && groups.length > 0 && (
        <dl className="divide-y divide-border">
          {groups.map(({ key, title, icon: Icon }) => (
            <div
              key={key}
              className="grid gap-1.5 py-2 text-sm sm:grid-cols-[7rem_minmax(0,1fr)]"
            >
              <dt className="flex items-center gap-1.5 font-medium">
                <Icon aria-hidden="true" className="size-3.5" />
                {title}
              </dt>
              <dd className="flex min-w-0 flex-wrap gap-1.5">
                {details[key].map((requirement) => (
                  <Badge
                    key={requirement}
                    variant="outline"
                    className="h-auto rounded-md text-left whitespace-normal"
                  >
                    {requirement}
                  </Badge>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
