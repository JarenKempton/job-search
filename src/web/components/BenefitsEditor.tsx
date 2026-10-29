import { useId } from "react";
import {
  AVAILABILITIES,
  BENEFIT_GROUPS,
  PTO_POLICIES,
  SICK_POLICIES,
  STIPEND_CADENCES,
  type BenefitKey,
  type Benefits,
  type Money,
} from "@/applications/benefits";
import { Field } from "@/web/components/fields";
import { Button } from "@/web/components/ui/button";
import { Input } from "@/web/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/web/components/ui/select";
import { Textarea } from "@/web/components/ui/textarea";

function NumberFact({
  title,
  value,
  onChange,
  max,
  whole = false,
}: {
  title: string;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  max?: number;
  whole?: boolean;
}) {
  const id = useId();
  return (
    <Field id={id} title={title}>
      <Input
        id={id}
        type="number"
        min={0}
        max={max}
        step={whole ? 1 : "any"}
        placeholder="Unknown"
        value={value ?? ""}
        onChange={(event) =>
          onChange(
            event.target.value === "" ? null : Number(event.target.value),
          )
        }
      />
    </Field>
  );
}

function TextFact({
  title,
  value,
  onChange,
}: {
  title: string;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
}) {
  const id = useId();
  return (
    <Field id={id} title={title}>
      <Input
        id={id}
        maxLength={200}
        placeholder="Unknown"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
      />
    </Field>
  );
}

function Options<T extends string>({
  title,
  value,
  options,
  onChange,
  unknown = true,
}: {
  title: string;
  value: T | null | undefined;
  options: readonly T[];
  onChange: (value: T | null) => void;
  unknown?: boolean;
}) {
  const id = useId();
  return (
    <Field id={id} title={title}>
      <Select
        value={value ?? "unset"}
        onValueChange={(next) =>
          onChange(next === "unset" ? null : (next as T))
        }
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {unknown && <SelectItem value="unset">Unknown</SelectItem>}
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option === "unknown"
                ? "Unknown"
                : option === "not_offered"
                  ? "Not offered"
                  : option.replaceAll("_", " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function MoneyFact({
  title,
  value,
  onChange,
}: {
  title: string;
  value: Money | null | undefined;
  onChange: (value: Money | null) => void;
}) {
  const id = useId();
  return (
    <fieldset className="grid grid-cols-[minmax(0,1fr)_5rem] gap-2">
      <legend className="mb-1 text-sm font-medium">{title}</legend>
      <Field id={id} title="Amount">
        <Input
          id={id}
          type="number"
          min={0}
          step="0.01"
          placeholder="Unknown"
          value={value?.amountCents == null ? "" : value.amountCents / 100}
          onChange={(event) =>
            onChange({
              ...value,
              currency: value?.currency ?? null,
              amountCents:
                event.target.value === ""
                  ? null
                  : Math.round(Number(event.target.value) * 100),
            })
          }
        />
      </Field>
      <Field id={`${id}-currency`} title="Currency">
        <Input
          id={`${id}-currency`}
          maxLength={3}
          placeholder="USD"
          value={value?.currency ?? ""}
          onChange={(event) =>
            onChange({
              ...value,
              currency: event.target.value.toUpperCase() || null,
            })
          }
        />
      </Field>
    </fieldset>
  );
}

export function BenefitsEditor({
  value,
  onChange,
}: {
  value: Benefits | null;
  onChange: (value: Benefits | null) => void;
}) {
  const id = useId();
  function change<K extends BenefitKey>(
    key: K,
    patch: Partial<NonNullable<Benefits[K]>>,
  ) {
    const group = {
      availability: "unknown" as const,
      ...value?.[key],
      ...patch,
    };
    if (patch.availability === "not_offered") {
      for (const field of Object.keys(group))
        if (!["availability", "source", "checkedOn", "notes"].includes(field))
          Object.assign(group, { [field]: null });
    }
    if (
      (key === "pto" && "policy" in patch && patch.policy === "unlimited") ||
      (key === "sickLeave" &&
        "policy" in patch &&
        patch.policy === "included_in_pto")
    )
      Object.assign(group, { daysPerYear: null });
    onChange({ ...value, [key]: group });
  }

  function facts(key: BenefitKey) {
    if (key === "pto") {
      const group = value?.pto;
      return (
        <>
          <Options
            title="PTO policy"
            value={group?.policy}
            options={PTO_POLICIES}
            onChange={(policy) => change(key, { policy })}
          />
          {group?.policy !== "unlimited" && (
            <NumberFact
              title="PTO days / year"
              value={group?.daysPerYear}
              onChange={(daysPerYear) => change(key, { daysPerYear })}
            />
          )}
          <NumberFact
            title="Rollover limit (days)"
            value={group?.rolloverDays}
            onChange={(rolloverDays) => change(key, { rolloverDays })}
          />
          <NumberFact
            title="Eligibility wait (days)"
            value={group?.eligibilityWaitingDays}
            whole
            onChange={(eligibilityWaitingDays) =>
              change(key, { eligibilityWaitingDays })
            }
          />
        </>
      );
    }
    if (key === "sickLeave") {
      const group = value?.sickLeave;
      return (
        <>
          <Options
            title="Sick leave policy"
            value={group?.policy}
            options={SICK_POLICIES}
            onChange={(policy) => change(key, { policy })}
          />
          {group?.policy !== "included_in_pto" && (
            <NumberFact
              title="Sick days / year"
              value={group?.daysPerYear}
              onChange={(daysPerYear) => change(key, { daysPerYear })}
            />
          )}
        </>
      );
    }
    if (key === "holidays") {
      const group = value?.holidays;
      return (
        <>
          <NumberFact
            title="Paid holidays / year"
            value={group?.daysPerYear}
            onChange={(daysPerYear) => change(key, { daysPerYear })}
          />
          <NumberFact
            title="Floating holidays / year"
            value={group?.floatingDaysPerYear}
            onChange={(floatingDaysPerYear) =>
              change(key, { floatingDaysPerYear })
            }
          />
        </>
      );
    }
    if (key === "medical" || key === "dental" || key === "vision") {
      const group = value?.[key];
      return (
        <>
          <MoneyFact
            title="Employee-only premium / month"
            value={group?.employeeMonthlyPremium}
            onChange={(employeeMonthlyPremium) =>
              change(key, { employeeMonthlyPremium })
            }
          />
          <MoneyFact
            title="Family premium / month"
            value={group?.familyMonthlyPremium}
            onChange={(familyMonthlyPremium) =>
              change(key, { familyMonthlyPremium })
            }
          />
          <NumberFact
            title="Employer contribution (%)"
            value={group?.employerContributionPercent}
            max={100}
            onChange={(employerContributionPercent) =>
              change(key, { employerContributionPercent })
            }
          />
          <MoneyFact
            title="Deductible"
            value={group?.deductible}
            onChange={(deductible) => change(key, { deductible })}
          />
          <NumberFact
            title="Coverage wait (days)"
            value={group?.coverageWaitingDays}
            whole
            onChange={(coverageWaitingDays) =>
              change(key, { coverageWaitingDays })
            }
          />
        </>
      );
    }
    if (key === "retirement") {
      const group = value?.retirement;
      return (
        <>
          <TextFact
            title="Plan type"
            value={group?.planType}
            onChange={(planType) => change(key, { planType })}
          />
          <NumberFact
            title="Separate employer contribution (% of salary)"
            value={group?.employerContributionPercent}
            max={100}
            onChange={(employerContributionPercent) =>
              change(key, { employerContributionPercent })
            }
          />
          <NumberFact
            title="Months until fully vested"
            value={group?.monthsUntilFullyVested}
            whole
            onChange={(monthsUntilFullyVested) =>
              change(key, { monthsUntilFullyVested })
            }
          />
          <div className="space-y-3 sm:col-span-2">
            <p className="text-sm text-muted-foreground">
              Match tiers use employee contribution ranges. A 100% match from
              0–4%, then 50% from 4–6%, is two tiers.
            </p>
            {group?.matchTiers?.map((tier, index) => (
              <fieldset key={index} className="grid gap-2 sm:grid-cols-3">
                <legend className="mb-2 text-sm font-medium">
                  Match tier {index + 1}
                </legend>
                <NumberFact
                  title="Employee from (%)"
                  value={tier.employeeFromPercent}
                  max={100}
                  onChange={(next) =>
                    change(key, {
                      matchTiers: group.matchTiers!.map((item, at) =>
                        at === index
                          ? { ...item, employeeFromPercent: next }
                          : item,
                      ),
                    })
                  }
                />
                <NumberFact
                  title="Employee to (%)"
                  value={tier.employeeToPercent}
                  max={100}
                  onChange={(next) =>
                    change(key, {
                      matchTiers: group.matchTiers!.map((item, at) =>
                        at === index
                          ? { ...item, employeeToPercent: next }
                          : item,
                      ),
                    })
                  }
                />
                <NumberFact
                  title="Employer match rate (%)"
                  value={tier.matchPercent}
                  onChange={(next) =>
                    change(key, {
                      matchTiers: group.matchTiers!.map((item, at) =>
                        at === index ? { ...item, matchPercent: next } : item,
                      ),
                    })
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    change(key, {
                      matchTiers: group.matchTiers!.filter(
                        (_, at) => at !== index,
                      ),
                    })
                  }
                >
                  Remove tier {index + 1}
                </Button>
              </fieldset>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  change(key, {
                    matchTiers: [
                      ...(group?.matchTiers ?? []),
                      {
                        employeeFromPercent: null,
                        employeeToPercent: null,
                        matchPercent: null,
                      },
                    ],
                  })
                }
              >
                Add match tier
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => change(key, { matchTiers: null })}
              >
                Match unknown
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => change(key, { matchTiers: [] })}
              >
                Confirm no match
              </Button>
            </div>
          </div>
        </>
      );
    }
    if (key === "parentalLeave") {
      const policies = value?.parentalLeave?.policies;
      return (
        <div className="space-y-3 sm:col-span-2">
          {policies?.map((policy, index) => {
            const update = (patch: Partial<typeof policy>) =>
              change(key, {
                policies: policies.map((item, at) =>
                  at === index ? { ...item, ...patch } : item,
                ),
              });
            return (
              <fieldset key={index} className="grid gap-3 sm:grid-cols-2">
                <legend className="mb-2 text-sm font-medium">
                  Parent policy {index + 1}
                </legend>
                <TextFact
                  title="Eligible parent category"
                  value={policy.eligibleParents}
                  onChange={(next) => update({ eligibleParents: next ?? "" })}
                />
                <NumberFact
                  title="Paid weeks"
                  value={policy.paidWeeks}
                  onChange={(paidWeeks) => update({ paidWeeks })}
                />
                <NumberFact
                  title="Pay (%)"
                  value={policy.payPercent}
                  max={100}
                  onChange={(payPercent) => update({ payPercent })}
                />
                <NumberFact
                  title="Unpaid weeks"
                  value={policy.unpaidWeeks}
                  onChange={(unpaidWeeks) => update({ unpaidWeeks })}
                />
                <NumberFact
                  title="Eligibility wait (days)"
                  value={policy.eligibilityWaitingDays}
                  whole
                  onChange={(eligibilityWaitingDays) =>
                    update({ eligibilityWaitingDays })
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    change(key, {
                      policies: policies.filter((_, at) => at !== index),
                    })
                  }
                >
                  Remove policy {index + 1}
                </Button>
              </fieldset>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              change(key, {
                policies: [...(policies ?? []), { eligibleParents: "" }],
              })
            }
          >
            Add parent policy
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => change(key, { policies: null })}
          >
            Policies unknown
          </Button>
        </div>
      );
    }
    const items = value?.stipends?.items;
    return (
      <div className="space-y-3 sm:col-span-2">
        {items?.map((item, index) => {
          const update = (patch: Partial<typeof item>) =>
            change("stipends", {
              items: items.map((existing, at) =>
                at === index ? { ...existing, ...patch } : existing,
              ),
            });
          return (
            <fieldset key={index} className="grid gap-3 sm:grid-cols-2">
              <legend className="mb-2 text-sm font-medium">
                Perk {index + 1}
              </legend>
              <TextFact
                title="Category"
                value={item.category}
                onChange={(next) => update({ category: next ?? "" })}
              />
              <MoneyFact
                title="Amount"
                value={item.amount}
                onChange={(amount) => update({ amount })}
              />
              <Options
                title="Cadence"
                value={item.cadence}
                options={STIPEND_CADENCES}
                onChange={(cadence) => update({ cadence })}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  change("stipends", {
                    items: items.filter((_, at) => at !== index),
                  })
                }
              >
                Remove perk {index + 1}
              </Button>
            </fieldset>
          );
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            change("stipends", { items: [...(items ?? []), { category: "" }] })
          }
        >
          Add stipend or perk
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => change("stipends", { items: null })}
        >
          Perks unknown
        </Button>
      </div>
    );
  }

  return (
    <div className="span-2 space-y-2">
      <p className="text-sm text-muted-foreground">
        Blank means unknown. Enter 0 only when confirmed. Money uses normal
        amounts; specify its three-letter currency code.
      </p>
      {BENEFIT_GROUPS.map(({ key, title }) => {
        const group = value?.[key];
        return (
          <details
            key={key}
            className="rounded-lg border border-border px-3 py-2"
          >
            <summary className="cursor-pointer text-sm font-medium">
              {title}
              <span className="ml-2 font-normal text-muted-foreground">
                {group?.availability === "offered"
                  ? "Offered"
                  : group?.availability === "not_offered"
                    ? "Not offered"
                    : "Unknown"}
              </span>
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Options
                title="Availability"
                value={group?.availability ?? "unknown"}
                options={AVAILABILITIES}
                unknown={false}
                onChange={(availability) =>
                  change(key, { availability: availability ?? "unknown" })
                }
              />
              {group?.availability !== "not_offered" && facts(key)}
              <Field id={`${id}-${key}-source`} title="Source URL or reference">
                <Input
                  id={`${id}-${key}-source`}
                  maxLength={5000}
                  value={group?.source ?? ""}
                  onChange={(event) =>
                    change(key, { source: event.target.value || null })
                  }
                />
              </Field>
              <Field id={`${id}-${key}-checked`} title="Date checked">
                <Input
                  id={`${id}-${key}-checked`}
                  type="date"
                  value={group?.checkedOn ?? ""}
                  onChange={(event) =>
                    change(key, { checkedOn: event.target.value || null })
                  }
                />
              </Field>
              <Field
                id={`${id}-${key}-notes`}
                title="Caveats or notes"
                className="sm:col-span-2"
              >
                <Textarea
                  id={`${id}-${key}-notes`}
                  rows={2}
                  maxLength={5000}
                  value={group?.notes ?? ""}
                  onChange={(event) =>
                    change(key, { notes: event.target.value || null })
                  }
                />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange({ ...value, [key]: null })}
              >
                Clear {title.toLowerCase()}
              </Button>
            </div>
          </details>
        );
      })}
    </div>
  );
}
