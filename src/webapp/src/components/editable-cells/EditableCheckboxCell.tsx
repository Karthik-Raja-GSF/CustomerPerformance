import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Checkbox } from "@/shadcn/components/checkbox";

interface EditableCheckboxCellProps {
  value: boolean;
  onSave: (value: boolean) => Promise<void>;
  disabled?: boolean;
}

export function EditableCheckboxCell({
  value,
  onSave,
  disabled = false,
}: EditableCheckboxCellProps) {
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = async (checked: boolean) => {
    if (disabled || isSaving) return;

    setIsSaving(true);
    try {
      await onSave(checked);
    } catch {
      // Error is handled by parent (toast shown)
    } finally {
      setIsSaving(false);
    }
  };

  if (isSaving) {
    return (
      <div className="flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center">
      <Checkbox
        checked={value}
        onCheckedChange={handleChange}
        disabled={disabled}
        aria-label="Confirmed"
        className="cursor-pointer"
      />
    </div>
  );
}
