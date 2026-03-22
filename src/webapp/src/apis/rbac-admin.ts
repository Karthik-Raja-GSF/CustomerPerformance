import { apiClient } from "@/apis/client";
import type {
  RbacGroup,
  CreateGroupInput,
  UpdateGroupInput,
} from "@/types/rbac";

interface ApiResponse<T> {
  status: string;
  data: T;
}

export async function fetchGroups(): Promise<RbacGroup[]> {
  const response =
    await apiClient.get<ApiResponse<RbacGroup[]>>("/rbac/groups");
  return response.data;
}

export async function createGroup(data: CreateGroupInput): Promise<RbacGroup> {
  const response = await apiClient.post<ApiResponse<RbacGroup>>(
    "/rbac/groups",
    data
  );
  return response.data;
}

export async function updateGroup(
  id: string,
  data: UpdateGroupInput
): Promise<RbacGroup> {
  const response = await apiClient.put<ApiResponse<RbacGroup>>(
    `/rbac/groups/${id}`,
    data
  );
  return response.data;
}

export async function deleteGroup(id: string): Promise<void> {
  await apiClient.delete(`/rbac/groups/${id}`);
}

export async function setGroupFeatures(
  groupId: string,
  featureKeys: string[]
): Promise<RbacGroup> {
  const response = await apiClient.put<ApiResponse<RbacGroup>>(
    `/rbac/groups/${groupId}/features`,
    { featureKeys }
  );
  return response.data;
}
