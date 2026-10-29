import {
  BENEFIT_GROUPS,
  type BenefitKey,
  type Benefits,
  type Money,
} from "@/applications/benefits";
import { BENEFIT_FIELDS } from "@/applications/fields";
import type { Application } from "@/web/api";

type BenefitsRow = Pick<
  Application,
  "benefits" | (typeof BENEFIT_FIELDS)[number]["key"]
>;

function money(value: Money | null | undefined) {
  if (value?.amountCents == null) return "amount unknown";
  return `${value.currency} ${(value.amountCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function facts(benefits: Benefits, key: BenefitKey): string[] {
  const lines: string[] = [];
  const number = (
    name: string,
    value: number | null | undefined,
    unit: string,
  ) => {
    if (value != null) lines.push(`${name}${value}${unit}`);
  };
  if (key === "pto") {
    const group = benefits.pto;
    if (group?.policy)
      lines.push(
        group.policy === "unlimited"
          ? "Unlimited PTO"
          : `${group.policy} policy`,
      );
    number("", group?.daysPerYear, " days/year");
    number("Rollover: ", group?.rolloverDays, " days");
    number("Eligibility wait: ", group?.eligibilityWaitingDays, " days");
  } else if (key === "sickLeave") {
    const group = benefits.sickLeave;
    if (group?.policy)
      lines.push(
        group.policy === "included_in_pto"
          ? "Included in PTO"
          : "Separate allowance",
      );
    number("", group?.daysPerYear, " days/year");
  } else if (key === "holidays") {
    number("", benefits.holidays?.daysPerYear, " paid days/year");
    number("", benefits.holidays?.floatingDaysPerYear, " floating days/year");
  } else if (key === "medical" || key === "dental" || key === "vision") {
    const group = benefits[key];
    if (group?.employeeMonthlyPremium)
      lines.push(`Employee: ${money(group.employeeMonthlyPremium)}/month`);
    if (group?.familyMonthlyPremium)
      lines.push(`Family: ${money(group.familyMonthlyPremium)}/month`);
    number("Employer contribution: ", group?.employerContributionPercent, "%");
    if (group?.deductible) lines.push(`Deductible: ${money(group.deductible)}`);
    number("Coverage wait: ", group?.coverageWaitingDays, " days");
  } else if (key === "retirement") {
    const group = benefits.retirement;
    if (group?.planType) lines.push(group.planType);
    if (group?.matchTiers?.length === 0) lines.push("No employer match");
    group?.matchTiers?.forEach((tier) =>
      lines.push(
        `${tier.matchPercent == null ? "Unknown rate" : `${tier.matchPercent}%`} match on employee contributions from ${tier.employeeFromPercent ?? "?"}–${tier.employeeToPercent ?? "?"}% of salary`,
      ),
    );
    number(
      "Separate employer contribution: ",
      group?.employerContributionPercent,
      "% of salary",
    );
    number("Fully vested after ", group?.monthsUntilFullyVested, " months");
  } else if (key === "parentalLeave") {
    benefits.parentalLeave?.policies?.forEach((policy) => {
      const terms = [
        policy.paidWeeks == null
          ? "paid weeks unknown"
          : `${policy.paidWeeks} paid weeks`,
        policy.payPercent == null
          ? "pay rate unknown"
          : `${policy.payPercent}% pay`,
        policy.unpaidWeeks == null
          ? "unpaid weeks unknown"
          : `${policy.unpaidWeeks} unpaid weeks`,
        policy.eligibilityWaitingDays == null
          ? "eligibility unknown"
          : `${policy.eligibilityWaitingDays}-day eligibility wait`,
      ];
      lines.push(`${policy.eligibleParents}: ${terms.join(", ")}`);
    });
  } else if (key === "stipends") {
    benefits.stipends?.items?.forEach((item) =>
      lines.push(
        `${item.category}: ${money(item.amount)} · ${item.cadence?.replaceAll("_", " ") ?? "cadence unknown"}`,
      ),
    );
  }
  return lines;
}

export function BenefitsSummary({ row }: { row: BenefitsRow }) {
  const legacy = BENEFIT_FIELDS.filter(({ key }) => row[key]?.trim());
  const groups = BENEFIT_GROUPS.filter(
    ({ key }) => row.benefits?.[key] != null,
  );
  if (!groups.length && !legacy.length) return null;
  return (
    <section aria-label="Benefits" className="space-y-3">
      <h3 className="text-sm font-semibold">Benefits</h3>
      <p className="text-xs text-muted-foreground">
        Recorded policy details. Unlisted information remains unknown.
      </p>
      <dl className="divide-y divide-border">
        {groups.map(({ key, title }) => {
          const group = row.benefits![key]!;
          const lines =
            group.availability === "not_offered"
              ? []
              : facts(row.benefits!, key);
          return (
            <div
              key={key}
              className="grid gap-1 py-2 text-sm sm:grid-cols-[8rem_minmax(0,1fr)]"
            >
              <dt className="font-medium">{title}</dt>
              <dd className="min-w-0 space-y-1">
                <p className="text-muted-foreground">
                  {group.availability === "offered"
                    ? "Offered"
                    : group.availability === "not_offered"
                      ? "Not offered"
                      : "Availability unknown"}
                </p>
                {lines.map((line, index) => (
                  <p key={index}>{line}</p>
                ))}
                {!lines.length && group.availability !== "not_offered" && (
                  <p className="text-muted-foreground">
                    Policy details unknown
                  </p>
                )}
                {group.notes && (
                  <p className="whitespace-pre-wrap">{group.notes}</p>
                )}
                {(group.source || group.checkedOn) && (
                  <p className="break-words text-xs text-muted-foreground">
                    {group.source}
                    {group.source && group.checkedOn ? " · " : ""}
                    {group.checkedOn && `Checked ${group.checkedOn}`}
                  </p>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      {legacy.length > 0 && (
        <details className="rounded-lg border border-border px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium">
            Legacy policy text & source notes
          </summary>
          <dl className="mt-3 space-y-3 text-sm">
            {legacy.map(({ key, title }) => (
              <div key={key}>
                <dt className="font-medium">{title}</dt>
                <dd className="whitespace-pre-wrap break-words text-muted-foreground">
                  {row[key]}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </section>
  );
}
