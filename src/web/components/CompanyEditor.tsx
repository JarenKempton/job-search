import { useState } from "react";
import type { CompanyProfile } from "@/applications/company";
import { Field } from "@/web/components/fields";
import { Input } from "@/web/components/ui/input";
import { Textarea } from "@/web/components/ui/textarea";

type TextKey = "tagline" | "about" | "website" | "linkedin" | "size";

export function CompanyEditor({
  value,
  onChange,
}: {
  value: CompanyProfile | null;
  onChange: (value: CompanyProfile) => void;
}) {
  const profile = value ?? {};
  const [industries, setIndustries] = useState(
    profile.industries?.join(", ") ?? "",
  );
  const text = (key: TextKey) => ({
    id: `company-${key}`,
    value: profile[key] ?? "",
    onChange: (event: { target: { value: string } }) =>
      onChange({
        ...profile,
        [key]: event.target.value.trim() ? event.target.value : null,
      }),
  });

  return (
    <>
      <Field
        id="company-tagline"
        title="What they do"
        hint="One sentence"
        className="span-2"
      >
        <Input maxLength={160} {...text("tagline")} />
      </Field>
      <Field id="company-about" title="About" className="span-2">
        <Textarea rows={4} maxLength={2000} {...text("about")} />
      </Field>
      <Field id="company-website" title="Website">
        <Input type="url" placeholder="https://" {...text("website")} />
      </Field>
      <Field id="company-linkedin" title="LinkedIn">
        <Input type="url" placeholder="https://" {...text("linkedin")} />
      </Field>
      <Field id="company-size" title="Size">
        <Input placeholder="11-50 employees" {...text("size")} />
      </Field>
      <Field id="company-founded" title="Founded">
        <Input
          id="company-founded"
          type="number"
          min={1600}
          max={2100}
          value={profile.founded ?? ""}
          onChange={(event) =>
            onChange({
              ...profile,
              founded:
                event.target.value === "" ? null : Number(event.target.value),
            })
          }
        />
      </Field>
      <Field
        id="company-industries"
        title="Industries"
        hint="Comma-separated"
        className="span-2"
      >
        <Input
          id="company-industries"
          placeholder="Consulting, Hospitality"
          value={industries}
          onChange={(event) => {
            setIndustries(event.target.value);
            onChange({
              ...profile,
              industries: event.target.value
                .split(",")
                .map((industry) => industry.trim())
                .filter(Boolean),
            });
          }}
        />
      </Field>
    </>
  );
}
