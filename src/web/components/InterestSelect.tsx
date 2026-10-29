import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/web/components/ui/select";

export const INTEREST_LEVELS = [
  { value: 1, label: "Low interest" },
  { value: 2, label: "Maybe" },
  { value: 3, label: "Interested" },
  { value: 4, label: "High interest" },
  { value: 5, label: "Top choice" },
] as const;

export function InterestSelect({
  value,
  onChange,
  disabled,
  id,
  label = "Interest",
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  id?: string;
  label?: string;
}) {
  return (
    <Select
      value={value?.toString() ?? "unrated"}
      onValueChange={(next) =>
        onChange(next === "unrated" ? null : Number(next))
      }
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-label={label} className="w-full min-w-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="start">
        <SelectItem value="unrated">Not rated</SelectItem>
        {INTEREST_LEVELS.map((level) => (
          <SelectItem key={level.value} value={level.value.toString()}>
            {level.value} · {level.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
