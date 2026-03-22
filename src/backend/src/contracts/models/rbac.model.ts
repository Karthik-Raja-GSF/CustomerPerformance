export interface RbacGroupModel {
  id: string;
  key: string;
  displayName: string;
  azureAdGroupId: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RbacGroupFeatureModel {
  id: string;
  groupId: string;
  featureKey: string;
  createdAt: Date;
}
