import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { Benefits } from "../applications/benefits";
import type { JobMatch } from "../match";
import type {
  ApplyMethod,
  EmploymentType,
  EventKind,
  Requirement,
  Source,
  Status,
  WorkMode,
} from "../applications/fields";

export const applications = sqliteTable(
  "applications",
  {
    id: text("id").primaryKey(),
    company: text("company").notNull(),
    role: text("role").notNull(),
    jobUrl: text("job_url"),
    location: text("location"),
    workMode: text("work_mode").$type<WorkMode>(),
    employmentType: text("employment_type").$type<EmploymentType>(),
    source: text("source").$type<Source>(),
    sourceDetail: text("source_detail"),
    applyMethod: text("apply_method").$type<ApplyMethod>(),
    requirements: text("requirements", { mode: "json" })
      .$type<Requirement[]>()
      .notNull()
      .default([]),
    resumeVersion: text("resume_version"),
    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    yearsRequired: integer("years_required"),
    fit: integer("fit"),
    fitDetails: text("fit_details", { mode: "json" }).$type<FitDetails>(),
    interest: integer("interest"),
    status: text("status").$type<Status>().notNull().default("saved"),
    appliedOn: text("applied_on"),
    heardBackOn: text("heard_back_on"),
    followUpOn: text("follow_up_on"),
    skipFollowUp: integer("skip_follow_up", { mode: "boolean" })
      .notNull()
      .default(false),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    description: text("description"),
    notes: text("notes"),
    pto: text("pto"),
    sickLeave: text("sick_leave"),
    holidays: text("holidays"),
    healthcare: text("healthcare"),
    retirement: text("retirement"),
    parentalLeave: text("parental_leave"),
    otherBenefits: text("other_benefits"),
    benefitsNotes: text("benefits_notes"),
    benefitsSource: text("benefits_source"),
    benefits: text("benefits", { mode: "json" }).$type<Benefits>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("idx_applications_status").on(table.status),
    index("idx_applications_applied_on").on(table.appliedOn),
  ],
);

export const applicationEvents = sqliteTable(
  "application_events",
  {
    id: text("id").primaryKey(),
    applicationId: text("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    kind: text("kind").$type<EventKind>().notNull(),
    occurredOn: text("occurred_on").notNull(),
    note: text("note"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("idx_events_application").on(table.applicationId, table.occurredOn),
  ],
);

export const resumes = sqliteTable("resumes", {
  id: text("id").primaryKey(),
  text: text("text").notNull(),
  fileName: text("file_name"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type FitDetails = Omit<JobMatch, "match"> & { scoredAt: string };
export type Application = typeof applications.$inferSelect;
export type Resume = typeof resumes.$inferSelect;
export type ApplicationEvent = typeof applicationEvents.$inferSelect;
