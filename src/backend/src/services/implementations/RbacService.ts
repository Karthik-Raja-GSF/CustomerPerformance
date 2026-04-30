import { inject, injectable } from "tsyringe";
import { inject, injectable } from "tsyringe";
import { PrismaClient } from "@prisma/client";
import { config } from "@/config/index";
import { Feature } from "@/contracts/rbac/feature";
import type { UserAccessDto } from "@/contracts/dtos/rbac.dto";
import type { IRbacService } from "@/services/IRbacService";

interface CachedGroupData {
  key: string;
  displayName: string;
  features: string[];
}

/**
 * RBAC Service Implementation
 *
 * Resolves Azure AD group GUIDs into roles and features using database-backed
 * group definitions. Uses an in-memory cache with TTL to avoid per-request DB hits.
 * When RBAC is disabled (`RBAC_ENABLED=false`), all methods grant full access.
 */
@injectable()
export class RbacService implements IRbacService {
  private readonly enabled: boolean;
  private readonly allFeatures: string[];
  private cache: Map<string, CachedGroupData> | null = null;
  private allGroups: { enumKey: string; displayName: string }[] | null = null;
  private cacheExpiry = 0;
  private readonly cacheTtlMs = 30_000; // 30 seconds
  private loadPromise: Promise<void> | null = null;

  constructor(@inject("PrismaClient") private readonly prisma: PrismaClient) {
    this.enabled = config.rbac.enabled;
    this.allFeatures = Object.values(Feature);
  }

  private async ensureCache(): Promise<void> {
    if (this.cache && Date.now() < this.cacheExpiry) return;

    // Prevent concurrent cache loads (stampede protection)
    if (this.loadPromise) {
      await this.loadPromise;
      return;
    }

    this.loadPromise = this.loadCache();
    try {
      await this.loadPromise;
    } finally {
      this.loadPromise = null;
    }
  }

  private async loadCache(): Promise<void> {
    const groups = await this.prisma.rbacGroup.findMany({
      include: { groupFeatures: true },
    });

    const map = new Map<string, CachedGroupData>();
    const allGroupsList: { enumKey: string; displayName: string }[] = [];

    for (const group of groups) {
      const features = group.groupFeatures.map((gf) => gf.featureKey);
      allGroupsList.push({
        enumKey: group.key,
        displayName: group.displayName,
      });

      if (group.azureAdGroupId) {
        map.set(group.azureAdGroupId, {
          key: group.key,
          displayName: group.displayName,
          features,
        });
      }
    }

    this.cache = map;
    this.allGroups = allGroupsList;
    this.cacheExpiry = Date.now() + this.cacheTtlMs;
  }

  clearCache(): void {
    this.cache = null;
    this.allGroups = null;
    this.cacheExpiry = 0;
  }

  async resolveRoles(
    userGroups: string[]
  ): Promise<{ enumKey: string; displayName: string }[]> {
    if (!this.enabled) {
      await this.ensureCache();
      return this.allGroups ?? [];
    }

    await this.ensureCache();
    const roles: { enumKey: string; displayName: string }[] = [];
    for (const groupId of userGroups) {
      const group = this.cache!.get(groupId);
      if (group) {
        roles.push({ enumKey: group.key, displayName: group.displayName });
      }
    }
    return roles;
  }

  async resolveFeatures(userGroups: string[]): Promise<string[]> {
    if (!this.enabled) {
      return this.allFeatures;
    }

    await this.ensureCache();
    const features = new Set<string>();
    for (const groupId of userGroups) {
      const group = this.cache!.get(groupId);
      if (group) {
        for (const feature of group.features) {
          features.add(feature);
        }
      }
    }
    return [...features];
  }

  async hasFeature(userGroups: string[], feature: string): Promise<boolean> {
    if (!this.enabled) {
      return true;
    }

    await this.ensureCache();
    for (const groupId of userGroups) {
      const group = this.cache!.get(groupId);
      if (group && group.features.includes(feature)) {
        return true;
      }
    }
    return false;
  }

  async getUserAccess(userGroups: string[]): Promise<UserAccessDto> {
    return {
      enabled: this.enabled,
      roles: await this.resolveRoles(userGroups),
      features: await this.resolveFeatures(userGroups),
    };
  }
}
