export const STATUSES = [
  "saved",
  "applied",
  "screening",
  "interviewing",
  "offer",
  "accepted",
  "rejected",
  "ghosted",
  "withdrawn",
] as const;

export const SOURCES = [
  "linkedin",
  "indeed",
  "company_site",
  "referral",
  "recruiter",
  "wellfound",
  "hacker_news",
  "glassdoor",
  "other",
] as const;

export const APPLY_METHODS = [
  "portal",
  "easy_apply",
  "email",
  "recruiter",
  "referral",
  "other",
] as const;

export const REQUIREMENTS = [
  "resume",
  "cover_letter",
  "portfolio",
  "references",
  "questions",
  "assessment",
  "video",
  "transcript",
] as const;

export const WORK_MODES = ["remote", "hybrid", "onsite"] as const;

export const EMPLOYMENT_TYPES = [
  "full_time",
  "contract",
  "part_time",
  "internship",
] as const;

export const EVENT_KINDS = [
  "note",
  "status",
  "response",
  "call",
  "interview",
  "assessment",
  "follow_up",
  "offer",
] as const;

export type Status = (typeof STATUSES)[number];
export type Source = (typeof SOURCES)[number];
export type ApplyMethod = (typeof APPLY_METHODS)[number];
export type Requirement = (typeof REQUIREMENTS)[number];
export type WorkMode = (typeof WORK_MODES)[number];
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export type EventKind = (typeof EVENT_KINDS)[number];

export const CHANNELS = [
  "email",
  "linkedin",
  "phone",
  "text",
  "in_person",
  "other",
] as const;

export type Channel = (typeof CHANNELS)[number];

export const RESPONDED_STATUSES: readonly Status[] = [
  "screening",
  "interviewing",
  "offer",
  "accepted",
  "rejected",
];

export const CLOSED_STATUSES: readonly Status[] = [
  "accepted",
  "rejected",
  "ghosted",
  "withdrawn",
];

export const LABELS: Record<string, string> = {
  saved: "Saved",
  applied: "Applied",
  screening: "Screening",
  interviewing: "Interviewing",
  offer: "Offer",
  accepted: "Accepted",
  rejected: "Rejected",
  ghosted: "Ghosted",
  withdrawn: "Withdrawn",
  linkedin: "LinkedIn",
  indeed: "Indeed",
  company_site: "Company site",
  referral: "Referral",
  recruiter: "Recruiter",
  wellfound: "Wellfound",
  hacker_news: "Hacker News",
  glassdoor: "Glassdoor",
  other: "Other",
  portal: "Careers portal / ATS",
  easy_apply: "Easy apply",
  email: "Email",
  resume: "Resume",
  cover_letter: "Cover letter",
  portfolio: "Portfolio",
  references: "References",
  questions: "Written questions",
  assessment: "Take-home / assessment",
  video: "Video intro",
  transcript: "Transcript",
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
  full_time: "Full-time",
  contract: "Contract",
  part_time: "Part-time",
  internship: "Internship",
  note: "Note",
  status: "Status change",
  response: "Response",
  call: "Call",
  interview: "Interview",
  follow_up: "Follow-up sent",
  phone: "Phone",
  text: "Text message",
  in_person: "In person",
};

// Free text preserves policy details; blank means unknown, not no benefit.
export const BENEFIT_FIELDS = [
  {
    key: "pto",
    title: "Paid time off",
    hint: "Vacation allowance or unlimited PTO, accrual, and rollover rules",
  },
  {
    key: "sickLeave",
    title: "Sick leave",
    hint: "Paid sick days and any separate sick-leave policy",
  },
  {
    key: "holidays",
    title: "Holidays",
    hint: "Paid holidays, floating holidays, and shutdowns",
  },
  {
    key: "healthcare",
    title: "Healthcare",
    hint: "Medical, dental, and vision; employee premiums, deductible, and when coverage starts",
  },
  {
    key: "retirement",
    title: "Retirement",
    hint: "401(k) or pension, employer match, and vesting schedule",
  },
  {
    key: "parentalLeave",
    title: "Parental leave",
    hint: "Paid or unpaid leave and eligibility",
  },
  {
    key: "otherBenefits",
    title: "Other benefits",
    hint: "Disability coverage, education budget, equipment, stipends, and other perks",
  },
  {
    key: "benefitsNotes",
    title: "Benefits notes",
    hint: "Questions, caveats, and details still to confirm",
  },
  {
    key: "benefitsSource",
    title: "Benefits source",
    hint: "Posting URL, benefits document, or recruiter and date",
  },
] as const;

export type MatchRating = "strong" | "partial" | "stretch";

export const matchRating = (fit: number): MatchRating =>
  fit >= 60 ? "strong" : fit >= 40 ? "partial" : "stretch";
