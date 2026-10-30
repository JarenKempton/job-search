import {
  CheckIcon,
  CircleHelpIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
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

export function MatchBreakdown({ details }: { details: Details }) {
  const groups = GROUPS.filter(({ key }) => details[key]?.length);
  return (
    <section aria-label="Match breakdown" className="space-y-4">
      <h3 className="text-sm font-semibold">Match breakdown</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {PARTS.map(({ key, title }) => (
          <div key={key} className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <dt className="text-muted-foreground">{title}</dt>
              <dd className="tabular font-medium">{details[key] as number}</dd>
            </div>
            <Progress value={details[key] as number} aria-label={title} />
          </div>
        ))}
      </dl>
      {groups.length > 0 && (
        <dl className="space-y-4 pt-2">
          {groups.map(({ key, title, icon: Icon }) => (
            <div key={key} className="space-y-2">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Icon aria-hidden="true" className="size-3.5" />
                {title} · {details[key].length}
              </dt>
              <dd className="flex flex-wrap gap-2">
                {details[key].map((requirement) => (
                  <Badge
                    key={requirement}
                    variant="secondary"
                    className="h-auto rounded-md px-2.5 py-1 text-left text-sm font-normal whitespace-normal"
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
