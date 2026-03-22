import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shadcn/components/dialog";
import { Button } from "@/shadcn/components/button";
import { Checkbox } from "@/shadcn/components/checkbox";
import { Label } from "@/shadcn/components/label";
import { Feature } from "@/config/features";
import type { RbacGroup } from "@/types/rbac";

// Build a display-friendly list from Feature constants
const ALL_FEATURES = Object.entries(Feature).map(([label, key]) => ({
  key,
  label: label.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
}));

interface GroupFeaturesDialogProps {
  isOpen: boolean;
  group: RbacGroup | null;
  onClose: () => void;
  onSave: (groupId: string, featureKeys: string[]) => Promise<void>;
}

export function GroupFeaturesDialog({
  isOpen,
  group,
  onClose,
  onSave,
}: GroupFeaturesDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && group) {
      setSelected(new Set(group.features));
    }
  }, [isOpen, group]);

  const toggleFeature = (featureKey: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(featureKey)) {
        next.delete(featureKey);
      } else {
        next.add(featureKey);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === ALL_FEATURES.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(ALL_FEATURES.map((f) => f.key)));
    }
  };

  const handleSave = async () => {
    if (!group) return;
    setIsSaving(true);
    try {
      await onSave(group.id, [...selected]);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  if (!group) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Features for {group.displayName}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all"
              checked={selected.size === ALL_FEATURES.length}
              onCheckedChange={toggleAll}
            />
            <Label htmlFor="select-all" className="font-medium">
              Select All
            </Label>
          </div>
          <div className="h-px bg-border" />
          {ALL_FEATURES.map((feature) => (
            <div key={feature.key} className="flex items-center gap-2">
              <Checkbox
                id={feature.key}
                checked={selected.has(feature.key)}
                onCheckedChange={() => toggleFeature(feature.key)}
              />
              <Label htmlFor={feature.key}>{feature.label}</Label>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
