import type { ReactNode } from "react";
import { Label } from "@/web/components/ui/label";
import { label } from "@/web/format";

export function Field({
  id,
  title,
  hint,
  className,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`field ${className ?? ""}`}>
      <Label htmlFor={id}>{title}</Label>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  );
}

export function Choice<T extends string>({
  id,
  value,
  options,
  onChange,
  blank = "—",
}: {
  id: string;
  value: T | null;
  options: readonly T[];
  onChange: (value: T | null) => void;
  blank?: string | null;
}) {
  return (
    <select
      id={id}
      className="native-select"
      value={value ?? ""}
      onChange={(event) => onChange((event.target.value || null) as T | null)}
    >
      {blank !== null && <option value="">{blank}</option>}
      {options.map((option) => (
        <option key={option} value={option}>
          {label(option)}
        </option>
      ))}
    </select>
  );
}
