import { ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  APPLY_METHODS,
  BENEFIT_FIELDS,
  EMPLOYMENT_TYPES,
  REQUIREMENTS,
  SOURCES,
  STATUSES,
  WORK_MODES,
  type Requirement,
} from "@/applications/fields";
import { Choice, Field } from "@/web/components/fields";
import { BENEFIT_GROUPS } from "@/applications/benefits";
import { BenefitsEditor } from "@/web/components/BenefitsEditor";
import { InterestSelect } from "@/web/components/InterestSelect";
import type { FormApi } from "@/web/components/form-state";
import { Input } from "@/web/components/ui/input";
import { Textarea } from "@/web/components/ui/textarea";
import { label } from "@/web/format";

function Section({
  title,
  summary,
  children,
  open = false,
}: {
  title: string;
  summary: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details className="edit-section" open={open}>
      <summary>
        <ChevronRightIcon />
        <strong>{title}</strong>
        <span>{summary}</span>
      </summary>
      <div className="edit-grid">{children}</div>
    </details>
  );
}

export function EditSections({ form, set, text }: FormApi) {
  const toggle = (requirement: Requirement) =>
    set(
      "requirements",
      form.requirements.includes(requirement)
        ? form.requirements.filter((item) => item !== requirement)
        : [...form.requirements, requirement],
    );
  const benefitCount = BENEFIT_GROUPS.filter(
    ({ key }) => form.benefits?.[key] != null,
  ).length;

  return (
    <div className="edit-sections">
      <Section title="Progress" summary="Status and your interest" open>
        <Field id="status" title="Status">
          <Choice
            id="status"
            value={form.status}
            options={STATUSES}
            blank={null}
            onChange={(value) => set("status", value ?? "saved")}
          />
        </Field>
        <Field
          id="interest"
          title="Your interest"
          hint="Your preference, separate from resume match"
        >
          <InterestSelect
            id="interest"
            value={form.interest ? Number(form.interest) : null}
            onChange={(value) => set("interest", value?.toString() ?? "")}
          />
        </Field>
      </Section>
      <Section title="Job" summary="Company, role, link, location">
        <Field id="company" title="Company">
          <Input required {...text("company")} />
        </Field>
        <Field id="role" title="Role">
          <Input required {...text("role")} />
        </Field>
        <Field id="jobUrl" title="Posting URL" className="span-2">
          <Input type="url" placeholder="https://" {...text("jobUrl")} />
        </Field>
        <Field id="location" title="Location">
          <Input placeholder="City, or Remote (US)" {...text("location")} />
        </Field>
        <div className="pair">
          <Field id="workMode" title="Work mode">
            <Choice
              id="workMode"
              value={form.workMode}
              options={WORK_MODES}
              onChange={(v) => set("workMode", v)}
            />
          </Field>
          <Field id="employmentType" title="Type">
            <Choice
              id="employmentType"
              value={form.employmentType}
              options={EMPLOYMENT_TYPES}
              onChange={(v) => set("employmentType", v)}
            />
          </Field>
        </div>
      </Section>

      <Section title="Pay & fit" summary="Salary and resume match">
        <div className="pair">
          <Field id="salaryMin" title="Salary min" hint="USD/yr — 120k works">
            <Input inputMode="numeric" {...text("salaryMin")} />
          </Field>
          <Field id="salaryMax" title="Salary max">
            <Input inputMode="numeric" {...text("salaryMax")} />
          </Field>
        </div>
        <div className="pair">
          <Field id="fit" title="Resume match %">
            <Input type="number" min={0} max={100} {...text("fit")} />
          </Field>
        </div>
        <Field id="yearsRequired" title="Years experience asked">
          <Input type="number" min={0} max={50} {...text("yearsRequired")} />
        </Field>
      </Section>

      <Section title="Dates & contact" summary="Applied, heard back, follow up">
        <Field id="appliedOn" title="Applied on">
          <Input type="date" {...text("appliedOn")} />
        </Field>
        <Field id="heardBackOn" title="Heard back on">
          <Input type="date" {...text("heardBackOn")} />
        </Field>
        <Field id="followUpOn" title="Follow up on">
          <Input type="date" {...text("followUpOn")} />
        </Field>
        <Field id="contactName" title="Contact">
          <Input
            placeholder="Recruiter / hiring manager"
            {...text("contactName")}
          />
        </Field>
        <Field id="contactEmail" title="Contact email" className="span-2">
          <Input type="email" {...text("contactEmail")} />
        </Field>
      </Section>

      <Section
        title="Benefits"
        summary={
          benefitCount ? `${benefitCount} categories recorded` : "Unknown"
        }
      >
        <BenefitsEditor
          value={form.benefits}
          onChange={(benefits) => set("benefits", benefits)}
        />
        <details className="span-2">
          <summary className="cursor-pointer text-sm font-medium">
            Legacy policy text & source notes
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {BENEFIT_FIELDS.map(({ key, title, hint }) => (
              <Field key={key} id={key} title={title} hint={hint}>
                <Textarea rows={2} maxLength={5000} {...text(key)} />
              </Field>
            ))}
          </div>
        </details>
      </Section>

      <Section title="How you applied" summary="Source, method, materials">
        <Field id="source" title="Found it on">
          <Choice
            id="source"
            value={form.source}
            options={SOURCES}
            onChange={(v) => set("source", v)}
          />
        </Field>
        <Field id="sourceDetail" title="Source detail">
          <Input
            placeholder="Referrer, recruiter, list"
            {...text("sourceDetail")}
          />
        </Field>
        <Field id="applyMethod" title="Apply via">
          <Choice
            id="applyMethod"
            value={form.applyMethod}
            options={APPLY_METHODS}
            onChange={(v) => set("applyMethod", v)}
          />
        </Field>
        <Field id="resumeVersion" title="Resume version sent">
          <Input placeholder="backend-v3.pdf" {...text("resumeVersion")} />
        </Field>
        <div className="span-2 field">
          <span className="field-title">They ask for</span>
          <div className="checks">
            {REQUIREMENTS.map((requirement) => (
              <label key={requirement} className="check">
                <input
                  type="checkbox"
                  checked={form.requirements.includes(requirement)}
                  onChange={() => toggle(requirement)}
                />
                {label(requirement)}
              </label>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Job description" summary="Saved posting text">
        <Field
          id="description"
          title="Job description"
          hint="Paste it — postings disappear"
          className="span-2"
        >
          <Textarea rows={6} {...text("description")} />
        </Field>
      </Section>
    </div>
  );
}
