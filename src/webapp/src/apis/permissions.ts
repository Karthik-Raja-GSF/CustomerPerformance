import { apiClient } from "@/apis/client";

export interface UserAccessDto {
  enabled: boolean;
  roles: { enumKey: string; displayName: string }[];
  features: string[];
}

export async function fetchUserAccess(): Promise<UserAccessDto> {
  return apiClient.get<UserAccessDto>("/auth/access");
}
