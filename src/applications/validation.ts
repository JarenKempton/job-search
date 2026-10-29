import { z } from "zod";
import {
  APPLY_METHODS,
  EMPLOYMENT_TYPES,
  EVENT_KINDS,
  REQUIREMENTS,
  SOURCES,
  STATUSES,
  WORK_MODES,
} from "./fields";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

function optional<T extends z.ZodType>(schema: T) {
  return z
    .union([schema, z.literal("")])
    .nullable()
    .optional()
    .transform((value) => (value === "" ? null : value));
}

const text = (max: number) => optional(z.string().trim().max(max));
const whole = (min: number, max: number) =>
  optional(z.number().int().min(min).max(max));

export const applicationFields = {
  company: z.string().trim().min(1).max(200),
  role: z.string().trim().min(1).max(200),
  jobUrl: optional(z.url().max(2000)),
  location: text(200),
  workMode: optional(z.enum(WORK_MODES)),
  employmentType: optional(z.enum(EMPLOYMENT_TYPES)),
  source: optional(z.enum(SOURCES)),
  sourceDetail: text(200),
  applyMethod: optional(z.enum(APPLY_METHODS)),
  requirements: z.array(z.enum(REQUIREMENTS)).max(REQUIREMENTS.length),
  resumeVersion: text(200),
  salaryMin: whole(0, 10_000_000),
  salaryMax: whole(0, 10_000_000),
  yearsRequired: whole(0, 50),
  fit: whole(0, 100),
  interest: whole(1, 5),
  status: z.enum(STATUSES),
  appliedOn: optional(day),
  heardBackOn: optional(day),
  followUpOn: optional(day),
  contactName: text(200),
  contactEmail: optional(z.email().max(320)),
  description: text(50_000),
  notes: text(20_000),
  pto: text(5_000),
  sickLeave: text(5_000),
  holidays: text(5_000),
  healthcare: text(5_000),
  retirement: text(5_000),
  parentalLeave: text(5_000),
  otherBenefits: text(5_000),
  benefitsNotes: text(5_000),
  benefitsSource: text(5_000),
};

const salaryOrdered = (input: {
  salaryMin?: number | null;
  salaryMax?: number | null;
}) =>
  input.salaryMin == null ||
  input.salaryMax == null ||
  input.salaryMin <= input.salaryMax;

export const createApplicationSchema = z
  .object({
    ...applicationFields,
    requirements: applicationFields.requirements.default([]),
    status: applicationFields.status.default("saved"),
    today: day.optional(),
  })
  .refine(salaryOrdered, "Salary minimum must not exceed the maximum.");

export const updateApplicationSchema = z
  .object(applicationFields)
  .partial()
  .extend({ today: day.optional() })
  .refine(salaryOrdered, "Salary minimum must not exceed the maximum.");

export const createEventSchema = z.object({
  kind: z.enum(EVENT_KINDS),
  occurredOn: day,
  note: text(5_000),
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
export type CreateEventInput = z.infer<typeof createEventSchema>;
