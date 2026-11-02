import { ExternalLinkIcon } from "lucide-react";
import type { CompanyProfile } from "@/applications/company";
import { Badge } from "@/web/components/ui/badge";
import { Button } from "@/web/components/ui/button";

export function CompanyCard({ profile }: { profile: CompanyProfile }) {
  const facts = [
    profile.size,
    profile.founded != null && `Founded ${profile.founded}`,
  ].filter(Boolean);
  const links = [
    ["Website", profile.website],
    ["LinkedIn", profile.linkedin],
  ].filter((link): link is [string, string] => Boolean(link[1]));

  return (
    <section aria-label="About the company" className="company-card">
      {(facts.length > 0 || links.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {facts.length > 0 && (
            <p className="text-sm text-muted-foreground">{facts.join(" · ")}</p>
          )}
          <div className="ml-auto flex gap-2">
            {links.map(([title, href]) => (
              <Button key={title} asChild variant="outline" size="xs">
                <a href={href} target="_blank" rel="noreferrer">
                  {title} <ExternalLinkIcon />
                </a>
              </Button>
            ))}
          </div>
        </div>
      )}
      {profile.about && <p className="prose">{profile.about}</p>}
      {profile.industries && profile.industries.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {profile.industries.map((industry) => (
            <Badge key={industry} variant="secondary">
              {industry}
            </Badge>
          ))}
        </div>
      )}
    </section>
  );
}
