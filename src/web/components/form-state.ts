import { useState } from "react";
import type { Application, ApplicationInput } from "@/web/api";

const NUMERIC = [
  "salaryMin",
  "salaryMax",
  "yearsRequired",
  "fit",
  "interest",
] as const;

type Numeric = (typeof NUMERIC)[number];

export type FormState = Omit<ApplicationInput, Numeric> &
  Record<Numeric, string>;

export const EMPTY: FormState = {
  company: "",
  role: "",
  jobUrl: null,
  location: null,
  workMode: null,
  employmentType: null,
  source: null,
  sourceDetail: null,
  applyMethod: null,
  requirements: ["resume"],
  resumeVersion: null,
  salaryMin: "",
  salaryMax: "",
  yearsRequired: "",
  fit: "",
  interest: "",
  status: "saved",
  appliedOn: null,
  heardBackOn: null,
  followUpOn: null,
  contactName: null,
  contactEmail: null,
  description: null,
  notes: null,
  pto: null,
  sickLeave: null,
  holidays: null,
  healthcare: null,
  retirement: null,
  parentalLeave: null,
  otherBenefits: null,
  benefitsNotes: null,
  benefitsSource: null,
};

export function toForm(row: Application): FormState {
  const state = { ...EMPTY } as Record<string, unknown>;
  for (const key of Object.keys(EMPTY))
    state[key] = row[key as keyof Application];
  for (const key of NUMERIC) state[key] = row[key]?.toString() ?? "";
  return state as FormState;
}

export function toInput(state: FormState): ApplicationInput {
  const numbers = Object.fromEntries(
    NUMERIC.map((key) => {
      const text = state[key].replace(/[$,\s]/g, "");
      if (!text) return [key, null];
      const value = /k$/i.test(text)
        ? Number(text.slice(0, -1)) * 1000
        : Number(text);
      return [key, Number.isFinite(value) ? Math.round(value) : null];
    }),
  ) as Pick<ApplicationInput, Numeric>;
  return { ...state, ...numbers };
}

export function useFormState(initial: FormState = EMPTY) {
  const [form, setForm] = useState<FormState>(initial);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const text = (key: keyof FormState) => ({
    id: key,
    value: (form[key] as string | null) ?? "",
    onChange: (event: { target: { value: string } }) =>
      set(key, event.target.value as never),
  });
  return { form, setForm, set, text };
}

export type FormApi = ReturnType<typeof useFormState>;
