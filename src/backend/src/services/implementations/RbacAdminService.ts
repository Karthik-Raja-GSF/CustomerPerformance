import { inject, injectable } from "tsyringe";
import { PrismaClient } from "@prisma/client";
import type { IRbacAdminService } from "@/services/IRbacAdminService";
import type { IRbacService } from "@/services/IRbacService";
import { RBAC_SERVICE_TOKEN } from "@/services/IRbacService";
import type {
  RbacGroupDto,
  CreateRbacGroupDto,
  UpdateRbacGroupDto,
} from "@/contracts/dtos/rbac.dto";
import {
  RbacGroupNotFoundError,
  RbacDuplicateKeyError,
} from "@/utils/errors/rbac-errors";

@injectable()
export class RbacAdminService implements IRbacAdminService {
  constructor(
    @inject("PrismaClient") private readonly prisma: PrismaClient,
    @inject(RBAC_SERVICE_TOKEN) private readonly rbacService: IRbacService
  ) {}

  private toDto(group: {
    id: string;
    key: string;
    displayName: string;
    azureAdGroupId: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
    groupFeatures: { featureKey: string }[];
  }): RbacGroupDto {
    return {
      id: group.id,
      key: group.key,
      displayName: group.displayName,
      azureAdGroupId: group.azureAdGroupId,
      description: group.description,
      features: group.groupFeatures.map((gf) => gf.featureKey),
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    };
  }

  async findAllGroups(): Promise<RbacGroupDto[]> {
    const groups = await this.prisma.rbacGroup.findMany({
      include: { groupFeatures: true },
      orderBy: { key: "asc" },
    });
    return groups.map((g) => this.toDto(g));
  }

  async findGroupById(id: string): Promise<RbacGroupDto> {
    const group = await this.prisma.rbacGroup.findUnique({
      where: { id },
      include: { groupFeatures: true },
    });
    if (!group) {
      throw new RbacGroupNotFoundError();
    }
    return this.toDto(group);
  }

  async createGroup(data: CreateRbacGroupDto): Promise<RbacGroupDto> {
    const existing = await this.prisma.rbacGroup.findUnique({
      where: { key: data.key },
    });
    if (existing) {
      throw new RbacDuplicateKeyError(`Group key "${data.key}" already exists`);
    }

    const group = await this.prisma.rbacGroup.create({
      data: {
        key: data.key,
        displayName: data.displayName,
        azureAdGroupId: data.azureAdGroupId ?? "",
        description: data.description ?? null,
      },
      include: { groupFeatures: true },
    });

    this.rbacService.clearCache();
    return this.toDto(group);
  }

  async updateGroup(
    id: string,
    data: UpdateRbacGroupDto
  ): Promise<RbacGroupDto> {
    const existing = await this.prisma.rbacGroup.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new RbacGroupNotFoundError();
    }

    const group = await this.prisma.rbacGroup.update({
      where: { id },
      data: {
        ...(data.displayName !== undefined && {
          displayName: data.displayName,
        }),
        ...(data.azureAdGroupId !== undefined && {
          azureAdGroupId: data.azureAdGroupId,
        }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
      },
      include: { groupFeatures: true },
    });

    this.rbacService.clearCache();
    return this.toDto(group);
  }

  async deleteGroup(id: string): Promise<void> {
    const existing = await this.prisma.rbacGroup.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new RbacGroupNotFoundError();
    }

    await this.prisma.rbacGroup.delete({ where: { id } });
    this.rbacService.clearCache();
  }

  async setGroupFeatures(
    groupId: string,
    featureKeys: string[]
  ): Promise<RbacGroupDto> {
    const existing = await this.prisma.rbacGroup.findUnique({
      where: { id: groupId },
    });
    if (!existing) {
      throw new RbacGroupNotFoundError();
    }

    await this.prisma.$transaction([
      this.prisma.rbacGroupFeature.deleteMany({
        where: { groupId },
      }),
      ...featureKeys.map((featureKey) =>
        this.prisma.rbacGroupFeature.create({
          data: { groupId, featureKey },
        })
      ),
    ]);

    const group = await this.prisma.rbacGroup.findUnique({
      where: { id: groupId },
      include: { groupFeatures: true },
    });

    this.rbacService.clearCache();
    return this.toDto(group!);
  }
}
