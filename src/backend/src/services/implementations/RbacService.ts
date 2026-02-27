import { injectable } from "tsyringe";
import { config } from "@/config/index";
import { Feature } from "@/contracts/rbac/feature";
import type { RoleDefinition } from "@/contracts/rbac/role-config";
import type { UserAccessDto } from "@/contracts/dtos/rbac.dto";
import type { IRbacService } from "@/services/IRbacService";

/**
 * RBAC Service Implementation
 *
 * Resolves Azure AD group GUIDs into roles and features using environment config.
 * When RBAC is disabled (`RBAC_ENABLED=false`), all methods grant full access.
 */
@injectable()
export class RbacService implements IRbacService {
  private readonly enabled: boolean;
  private readonly groupToRole: Map<string, RoleDefinition>;
  private readonly allFeatures: string[];
  private readonly allRoles: { enumKey: string; displayName: string }[];

  constructor() {
    this.enabled = config.rbac.enabled;
    this.allFeatures = Object.values(Feature);
    this.allRoles = config.rbac.roles.map((r: RoleDefinition) => ({
      enumKey: r.enumKey,
      displayName: r.displayName,
    }));

    // Build group GUID → role lookup map (skip roles with empty groupId)
    this.groupToRole = new Map();
    for (const role of config.rbac.roles) {
      if (role.groupId) {
        this.groupToRole.set(role.groupId, role);
      }
    }
  }

  resolveRoles(
    userGroups: string[]
  ): { enumKey: string; displayName: string }[] {
    if (!this.enabled) {
      return this.allRoles;
    }

    const roles: { enumKey: string; displayName: string }[] = [];
    for (const groupId of userGroups) {
      const role = this.groupToRole.get(groupId);
      if (role) {
        roles.push({ enumKey: role.enumKey, displayName: role.displayName });
      }
    }
    return roles;
  }

  resolveFeatures(userGroups: string[]): string[] {
    if (!this.enabled) {
      return this.allFeatures;
    }

    const features = new Set<string>();
    for (const groupId of userGroups) {
      const role = this.groupToRole.get(groupId);
      if (role) {
        for (const feature of role.features) {
          features.add(feature);
        }
      }
    }
    return [...features];
  }

  hasFeature(userGroups: string[], feature: string): boolean {
    if (!this.enabled) {
      return true;
    }

    for (const groupId of userGroups) {
      const role = this.groupToRole.get(groupId);
      if (role && role.features.includes(feature as Feature)) {
        return true;
      }
    }
    return false;
  }

  getUserAccess(userGroups: string[]): UserAccessDto {
    return {
      enabled: this.enabled,
      roles: this.resolveRoles(userGroups),
      features: this.resolveFeatures(userGroups),
    };
  }
}
