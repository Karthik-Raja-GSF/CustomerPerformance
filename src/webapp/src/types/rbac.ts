export interface RbacGroup {
  id: string;
  key: string;
  displayName: string;
  azureAdGroupId: string;
  description: string | null;
  features: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateGroupInput {
  key: string;
  displayName: string;
  azureAdGroupId?: string;
  description?: string;
}

export interface UpdateGroupInput {
  displayName?: string;
  azureAdGroupId?: string;
  description?: string | null;
}
