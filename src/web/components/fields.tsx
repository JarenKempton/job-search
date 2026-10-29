import type { ReactNode } from "react";
import { Label } from "@/web/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/web/components/ui/select";
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
    <Select
      value={value ?? "__blank"}
      onValueChange={(next) =>
        onChange(next === "__blank" ? null : (next as T))
      }
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="start">
        {blank !== null && <SelectItem value="__blank">{blank}</SelectItem>}
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {label(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
