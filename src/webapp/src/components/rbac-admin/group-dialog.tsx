import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shadcn/components/dialog";
import { Button } from "@/shadcn/components/button";
import { Input } from "@/shadcn/components/input";
import { Label } from "@/shadcn/components/label";
import { Textarea } from "@/shadcn/components/textarea";
import type {
  RbacGroup,
  CreateGroupInput,
  UpdateGroupInput,
} from "@/types/rbac";

interface GroupDialogProps {
  isOpen: boolean;
  group: RbacGroup | null; // null = create, non-null = edit
  onClose: () => void;
  onSave: (data: CreateGroupInput | UpdateGroupInput) => Promise<void>;
}

export function GroupDialog({
  isOpen,
  group,
  onClose,
  onSave,
}: GroupDialogProps) {
  const isEdit = group !== null;
  const [key, setKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [azureAdGroupId, setAzureAdGroupId] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setKey(group?.key ?? "");
      setDisplayName(group?.displayName ?? "");
      setAzureAdGroupId(group?.azureAdGroupId ?? "");
      setDescription(group?.description ?? "");
    }
  }, [isOpen, group]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (isEdit) {
        const data: UpdateGroupInput = {
          displayName,
          azureAdGroupId,
          description: description || null,
        };
        await onSave(data);
      } else {
        const data: CreateGroupInput = {
          key: key.toUpperCase().replace(/\s+/g, "_"),
          displayName,
          azureAdGroupId: azureAdGroupId || undefined,
          description: description || undefined,
        };
        await onSave(data);
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Group" : "New Group"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="key">Key</Label>
            <Input
              id="key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="e.g. SALES"
              disabled={isEdit}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Sales"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="azureAdGroupId">Azure AD Group ID</Label>
            <Input
              id="azureAdGroupId"
              value={azureAdGroupId}
              onChange={(e) => setAzureAdGroupId(e.target.value)}
              placeholder="Azure AD group GUID"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : isEdit ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
