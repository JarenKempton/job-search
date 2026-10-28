import type { Application } from "../db/schema";

const COLUMNS: Array<keyof Application> = [
  "company",
  "role",
  "status",
  "source",
  "sourceDetail",
  "applyMethod",
  "requirements",
  "resumeVersion",
  "salaryMin",
  "salaryMax",
  "yearsRequired",
  "fit",
  "interest",
  "workMode",
  "employmentType",
  "location",
  "appliedOn",
  "heardBackOn",
  "followUpOn",
  "contactName",
  "contactEmail",
  "jobUrl",
  "notes",
  "pto",
  "sickLeave",
  "holidays",
  "healthcare",
  "retirement",
  "parentalLeave",
  "otherBenefits",
  "benefitsNotes",
  "benefitsSource",
];

function cell(value: unknown): string {
  if (value == null) return "";
  const text = Array.isArray(value) ? value.join("; ") : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function toCsv(rows: Application[]): string {
  const lines = [COLUMNS.join(",")];
  for (const row of rows)
    lines.push(COLUMNS.map((column) => cell(row[column])).join(","));
  return `${lines.join("\r\n")}\r\n`;
}
