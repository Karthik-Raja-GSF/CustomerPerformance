import type {
  RbacGroupDto,
  CreateRbacGroupDto,
  UpdateRbacGroupDto,
} from "@/contracts/dtos/rbac.dto";

export const RBAC_ADMIN_SERVICE_TOKEN = Symbol.for("IRbacAdminService");

export interface IRbacAdminService {
  findAllGroups(): Promise<RbacGroupDto[]>;
  findGroupById(id: string): Promise<RbacGroupDto>;
  createGroup(data: CreateRbacGroupDto): Promise<RbacGroupDto>;
  updateGroup(id: string, data: UpdateRbacGroupDto): Promise<RbacGroupDto>;
  deleteGroup(id: string): Promise<void>;
  setGroupFeatures(
    groupId: string,
    featureKeys: string[]
  ): Promise<RbacGroupDto>;
}
