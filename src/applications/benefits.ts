import { z } from "zod";

export const AVAILABILITIES = ["unknown", "offered", "not_offered"] as const;
export const PTO_POLICIES = ["fixed", "accrued", "unlimited"] as const;
export const SICK_POLICIES = ["separate", "included_in_pto"] as const;
export const STIPEND_CADENCES = ["monthly", "annual", "one_time"] as const;

const fact = <T extends z.ZodType>(schema: T) => schema.nullable().optional();
const amount = z.number().min(0).max(Number.MAX_SAFE_INTEGER);
const percent = z.number().min(0).max(100);
const days = fact(amount);
const waitingDays = fact(amount.int());
const note = fact(z.string().trim().max(5000));
const moneyFields = {
  amountCents: fact(amount.int()),
  currency: fact(
    z.string().regex(/^[A-Z]{3}$/, "Use a three-letter currency code."),
  ),
};
const money = z.strictObject(moneyFields);
const common = {
  availability: z.enum(AVAILABILITIES),
  source: note,
  checkedOn: fact(z.iso.date()),
  notes: note,
};

const matchTier = z
  .strictObject({
    employeeFromPercent: fact(percent),
    employeeToPercent: fact(percent),
    matchPercent: fact(amount),
  })
  .refine(
    (tier) =>
      tier.employeeFromPercent == null ||
      tier.employeeToPercent == null ||
      tier.employeeFromPercent < tier.employeeToPercent,
    {
      message:
        "A match tier must end above its starting contribution percentage.",
    },
  );

const matchTiers = fact(
  z
    .array(matchTier)
    .max(50)
    .refine(
      (tiers) =>
        tiers.every(
          (tier, index) =>
            index === 0 ||
            tier.employeeFromPercent == null ||
            tiers
              .slice(0, index)
              .every(
                (previous) =>
                  previous.employeeToPercent == null ||
                  tier.employeeFromPercent! >= previous.employeeToPercent,
              ),
        ),
      "Match tiers must be ordered and non-overlapping.",
    ),
);

const parentPolicy = z.strictObject({
  eligibleParents: z.string().trim().min(1).max(200),
  paidWeeks: days,
  payPercent: fact(percent),
  unpaidWeeks: days,
  eligibilityWaitingDays: waitingDays,
});
const stipend = z.strictObject({
  category: z.string().trim().min(1).max(200),
  amount: fact(money),
  cadence: fact(z.enum(STIPEND_CADENCES)),
});
const coverage = z.strictObject({
  ...common,
  employeeMonthlyPremium: fact(money),
  familyMonthlyPremium: fact(money),
  employerContributionPercent: fact(percent),
  deductible: fact(money),
  coverageWaitingDays: waitingDays,
});

const groups = {
  pto: z.strictObject({
    ...common,
    policy: fact(z.enum(PTO_POLICIES)),
    daysPerYear: days,
    rolloverDays: days,
    eligibilityWaitingDays: waitingDays,
  }),
  sickLeave: z.strictObject({
    ...common,
    policy: fact(z.enum(SICK_POLICIES)),
    daysPerYear: days,
  }),
  holidays: z.strictObject({
    ...common,
    daysPerYear: days,
    floatingDaysPerYear: days,
  }),
  medical: coverage,
  dental: coverage,
  vision: coverage,
  retirement: z.strictObject({
    ...common,
    planType: fact(z.string().trim().max(200)),
    matchTiers,
    employerContributionPercent: fact(percent),
    monthsUntilFullyVested: waitingDays,
  }),
  parentalLeave: z.strictObject({
    ...common,
    policies: fact(z.array(parentPolicy).max(50)),
  }),
  stipends: z.strictObject({
    ...common,
    items: fact(z.array(stipend).max(100)),
  }),
};

export const BENEFIT_GROUPS = [
  { key: "pto", title: "Paid time off" },
  { key: "sickLeave", title: "Sick leave" },
  { key: "holidays", title: "Paid holidays" },
  { key: "medical", title: "Medical" },
  { key: "dental", title: "Dental" },
  { key: "vision", title: "Vision" },
  { key: "retirement", title: "Retirement" },
  { key: "parentalLeave", title: "Parental leave" },
  { key: "stipends", title: "Stipends & perks" },
] as const;

function group<T extends z.ZodRawShape>(schema: z.ZodObject<T>) {
  return fact(
    schema.extend({ availability: common.availability.default("unknown") }),
  );
}

const coveragePatch = coverage.partial();
const groupShape = {
  pto: group(groups.pto),
  sickLeave: group(groups.sickLeave),
  holidays: group(groups.holidays),
  medical: group(coverage),
  dental: group(coverage),
  vision: group(coverage),
  retirement: group(groups.retirement),
  parentalLeave: group(groups.parentalLeave),
  stipends: group(groups.stipends),
};

export const benefitsSchema = z
  .strictObject(groupShape)
  .superRefine((benefits, ctx) => {
    const checkMoney = (
      value: z.infer<typeof money> | null | undefined,
      path: PropertyKey[],
    ) => {
      if (value?.amountCents != null && value.currency == null)
        ctx.addIssue({
          code: "custom",
          path,
          message: "Specify a currency for a known money amount.",
        });
    };
    for (const { key } of BENEFIT_GROUPS) {
      const group = benefits[key];
      if (!group) continue;
      if (group.availability === "not_offered") {
        for (const [field, value] of Object.entries(group)) {
          if (!(field in common) && value != null)
            ctx.addIssue({
              code: "custom",
              path: [key, field],
              message:
                "Not-offered benefits cannot contain policy facts. Clear the fact with null.",
            });
        }
      }
      if (key === "medical" || key === "dental" || key === "vision") {
        const plan = benefits[key];
        for (const field of [
          "employeeMonthlyPremium",
          "familyMonthlyPremium",
          "deductible",
        ] as const)
          checkMoney(plan?.[field], [key, field]);
      }
    }
    benefits.stipends?.items?.forEach((item, index) =>
      checkMoney(item.amount, ["stipends", "items", index, "amount"]),
    );
    if (
      benefits.pto?.policy === "unlimited" &&
      benefits.pto.daysPerYear != null
    )
      ctx.addIssue({
        code: "custom",
        path: ["pto", "daysPerYear"],
        message: "Unlimited PTO has no fixed annual allowance.",
      });
    if (
      benefits.sickLeave?.policy === "included_in_pto" &&
      benefits.sickLeave.daysPerYear != null
    )
      ctx.addIssue({
        code: "custom",
        path: ["sickLeave", "daysPerYear"],
        message: "Sick leave included in PTO has no separate annual allowance.",
      });
  });

export const benefitsPatchSchema = z.strictObject({
  pto: fact(groups.pto.partial()),
  sickLeave: fact(groups.sickLeave.partial()),
  holidays: fact(groups.holidays.partial()),
  medical: fact(coveragePatch),
  dental: fact(coveragePatch),
  vision: fact(coveragePatch),
  retirement: fact(groups.retirement.partial()),
  parentalLeave: fact(groups.parentalLeave.partial()),
  stipends: fact(groups.stipends.partial()),
});

export type Benefits = z.infer<typeof benefitsSchema>;
export type BenefitsPatch = z.infer<typeof benefitsPatchSchema>;
export type BenefitKey = keyof Benefits;
export type Money = z.infer<typeof money>;

export function mergeBenefits(
  existing: Benefits | null,
  patch: BenefitsPatch | null,
) {
  if (patch === null) return benefitsSchema.nullable().safeParse(null);
  const merged = { ...existing } as Record<string, unknown>;
  for (const { key } of BENEFIT_GROUPS) {
    const changes = patch[key];
    if (changes === undefined) continue;
    if (changes === null) {
      merged[key] = null;
      continue;
    }
    const previous = existing?.[key];
    const group: Record<string, unknown> = { ...previous };
    if (changes.availability === "not_offered") {
      for (const field of Object.keys(group))
        if (!(field in common)) group[field] = null;
    }
    if (
      (key === "pto" &&
        "policy" in changes &&
        changes.policy === "unlimited") ||
      (key === "sickLeave" &&
        "policy" in changes &&
        changes.policy === "included_in_pto")
    )
      group.daysPerYear = null;
    for (const [field, value] of Object.entries(changes)) {
      if (value === undefined) continue;
      group[field] =
        value !== null && typeof value === "object" && !Array.isArray(value)
          ? { ...(group[field] as object), ...value }
          : value;
    }
    merged[key] = group;
  }
  return benefitsSchema.nullable().safeParse(merged);
}
