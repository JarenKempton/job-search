import { useState } from "react";
import type {
  Application,
  ApplicationInput,
  ApplicationUpdate,
} from "@/web/api";
import { benefitsPatchSchema } from "@/applications/benefits";

const NUMERIC = [
  "salaryMin",
  "salaryMax",
  "yearsRequired",
  "fit",
  "interest",
] as const;

type Numeric = (typeof NUMERIC)[number];
type TextKey = {
  [K in keyof FormState]: FormState[K] extends string | null ? K : never;
}[keyof FormState];

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
  benefits: null,
};

export function toForm(row: Application): FormState {
  const state = { ...EMPTY } as Record<string, unknown>;
  for (const key of Object.keys(EMPTY))
    state[key] = row[key as keyof Application];
  for (const key of NUMERIC) state[key] = row[key]?.toString() ?? "";
  state.benefits = row.benefits ?? null;
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

function changedValue(value: unknown, baseline: unknown): unknown {
  if (JSON.stringify(value) === JSON.stringify(baseline)) return undefined;
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return value;
  const previous =
    baseline !== null &&
    typeof baseline === "object" &&
    !Array.isArray(baseline)
      ? (baseline as Record<string, unknown>)
      : {};
  const changes: Record<string, unknown> = {};
  for (const [key, next] of Object.entries(value)) {
    const change = changedValue(next, previous[key]);
    if (change !== undefined) changes[key] = change;
  }
  return Object.keys(changes).length ? changes : undefined;
}

export function toPatch(
  state: FormState,
  baseline: Application,
): ApplicationUpdate {
  const { benefits, ...current } = toInput(state);
  const { benefits: previousBenefits, ...previous } = toInput(toForm(baseline));
  const changes: ApplicationUpdate = Object.fromEntries(
    Object.entries(current).filter(
      ([key, value]) =>
        JSON.stringify(value) !==
        JSON.stringify(previous[key as keyof typeof previous]),
    ),
  );
  const benefitChanges = changedValue(benefits, previousBenefits);
  if (benefitChanges !== undefined)
    changes.benefits = benefitsPatchSchema.nullable().parse(benefitChanges);
  return changes;
}

export function useFormState(initial: FormState = EMPTY) {
  const [form, setForm] = useState<FormState>(initial);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const text = (key: TextKey) => ({
    id: key,
    value: (form[key] as string | null) ?? "",
    onChange: (event: { target: { value: string } }) =>
      set(key, event.target.value as never),
  });
  return { form, setForm, set, text };
}

export type FormApi = ReturnType<typeof useFormState>;
