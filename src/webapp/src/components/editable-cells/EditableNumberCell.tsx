import { useState, useRef, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/shadcn/components/input";

interface EditableNumberCellProps {
  value: number | null;
  onSave: (value: number | null) => Promise<void>;
  disabled?: boolean;
}

export function EditableNumberCell({
  value,
  onSave,
  disabled = false,
}: EditableNumberCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [inputValue, setInputValue] = useState(value?.toString() ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Update input value when prop changes
  useEffect(() => {
    if (!isEditing) {
      setInputValue(value?.toString() ?? "");
    }
  }, [value, isEditing]);

  const handleClick = () => {
    if (!disabled && !isSaving) {
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    const trimmed = inputValue.trim();
    const newValue = trimmed === "" ? null : parseFloat(trimmed);

    // Validate: must be empty or a valid number
    if (trimmed !== "" && (isNaN(newValue!) || newValue === null)) {
      setInputValue(value?.toString() ?? "");
      setIsEditing(false);
      return;
    }

    // Skip save if value hasn't changed
    if (newValue === value) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(newValue);
      setIsEditing(false);
    } catch {
      // Revert to original value on error
      setInputValue(value?.toString() ?? "");
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleSave();
    } else if (e.key === "Escape") {
      setInputValue(value?.toString() ?? "");
      setIsEditing(false);
    }
  };

  const handleBlur = () => {
    void handleSave();
  };

  if (isSaving) {
    return (
      <div className="flex items-center justify-end">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="h-7 w-20 text-right text-sm"
        step="any"
      />
    );
  }

  return (
    <div
      onClick={handleClick}
      className={`text-right cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 ${
        disabled ? "cursor-not-allowed opacity-50" : ""
      }`}
    >
      {value !== null ? value.toLocaleString() : "-"}
    </div>
  );
}
