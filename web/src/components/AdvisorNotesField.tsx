import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface AdvisorNoteFlag {
  enabled: boolean;
  required: boolean;
}

// Renders an advisor-notes input only when enabled for the section (per settings).
export function AdvisorNotesField({
  flag,
  value,
  onChange,
}: {
  flag?: AdvisorNoteFlag;
  value: string;
  onChange: (v: string) => void;
}) {
  // Until config loads (flag undefined) hide it; once loaded, respect `enabled`.
  if (!flag?.enabled) return null;
  return (
    <div className="space-y-1.5">
      <Label>Advisor notes{flag.required ? " *" : ""}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
