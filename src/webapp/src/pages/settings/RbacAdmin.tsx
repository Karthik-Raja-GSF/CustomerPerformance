import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Shield, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/shadcn/components/button";
import { Badge } from "@/shadcn/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shadcn/components/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shadcn/components/alert-dialog";
import { GroupDialog } from "@/components/rbac-admin/group-dialog";
import { GroupFeaturesDialog } from "@/components/rbac-admin/group-features-dialog";
import {
  fetchGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  setGroupFeatures,
} from "@/apis/rbac-admin";
import type {
  RbacGroup,
  CreateGroupInput,
  UpdateGroupInput,
} from "@/types/rbac";

export default function RbacAdmin() {
  const [groups, setGroups] = useState<RbacGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog states
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<RbacGroup | null>(null);
  const [featuresDialogOpen, setFeaturesDialogOpen] = useState(false);
  const [featuresGroup, setFeaturesGroup] = useState<RbacGroup | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState<RbacGroup | null>(null);

  const loadGroups = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchGroups();
      setGroups(data);
    } catch {
      toast.error("Failed to load groups");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  const handleCreateOrUpdate = async (
    data: CreateGroupInput | UpdateGroupInput
  ) => {
    if (editingGroup) {
      const updated = await updateGroup(
        editingGroup.id,
        data as UpdateGroupInput
      );
      setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
      toast.success("Group updated");
    } else {
      const created = await createGroup(data as CreateGroupInput);
      setGroups((prev) => [...prev, created]);
      toast.success("Group created");
    }
  };

  const handleDelete = async () => {
    if (!deletingGroup) return;
    try {
      await deleteGroup(deletingGroup.id);
      setGroups((prev) => prev.filter((g) => g.id !== deletingGroup.id));
      toast.success("Group deleted");
    } catch {
      toast.error("Failed to delete group");
    } finally {
      setDeleteDialogOpen(false);
      setDeletingGroup(null);
    }
  };

  const handleSetFeatures = async (groupId: string, featureKeys: string[]) => {
    const updated = await setGroupFeatures(groupId, featureKeys);
    setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    toast.success("Features updated");
  };

  const openCreate = () => {
    setEditingGroup(null);
    setGroupDialogOpen(true);
  };

  const openEdit = (group: RbacGroup) => {
    setEditingGroup(group);
    setGroupDialogOpen(true);
  };

  const openFeatures = (group: RbacGroup) => {
    setFeaturesGroup(group);
    setFeaturesDialogOpen(true);
  };

  const openDelete = (group: RbacGroup) => {
    setDeletingGroup(group);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="flex flex-1 flex-col gap-4 min-h-0">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          Manage access control groups and their feature permissions.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadGroups}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Group
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Display Name</TableHead>
              <TableHead>Azure AD Group ID</TableHead>
              <TableHead>Features</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : groups.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center py-8 text-muted-foreground"
                >
                  No groups configured.
                </TableCell>
              </TableRow>
            ) : (
              groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell className="font-mono text-sm">
                    {group.key}
                  </TableCell>
                  <TableCell>{group.displayName}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {group.azureAdGroupId || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {group.features.length} features
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openFeatures(group)}
                        title="Manage features"
                      >
                        <Shield className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(group)}
                        title="Edit group"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDelete(group)}
                        title="Delete group"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialogs */}
      <GroupDialog
        isOpen={groupDialogOpen}
        group={editingGroup}
        onClose={() => setGroupDialogOpen(false)}
        onSave={handleCreateOrUpdate}
      />

      <GroupFeaturesDialog
        isOpen={featuresDialogOpen}
        group={featuresGroup}
        onClose={() => setFeaturesDialogOpen(false)}
        onSave={handleSetFeatures}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;
              {deletingGroup?.displayName}
              &rdquo;? This will also remove all feature mappings for this
              group. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
