import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/web/components/ui/button";

export function JobDescription({ text }: { text: string }) {
  const body = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const element = body.current;
    if (element && !expanded)
      setOverflows(element.scrollHeight > element.clientHeight);
  }, [text, expanded]);

  return (
    <section aria-label="Job description" className="space-y-2">
      <h3 className="text-sm font-semibold">Job description</h3>
      <p
        ref={body}
        id="job-description"
        className={`prose text-muted-foreground ${expanded ? "" : "line-clamp-6"}`}
      >
        {text}
      </p>
      {(overflows || expanded) && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0"
          aria-expanded={expanded}
          aria-controls="job-description"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : "Show more"}
        </Button>
      )}
    </section>
  );
}
