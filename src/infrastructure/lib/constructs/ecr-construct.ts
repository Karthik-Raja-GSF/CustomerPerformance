import * as cdk from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import { Construct } from "constructs";
import {
  NamingConfig,
  createNamingHelper,
  ResourceTypes,
} from "../config/naming";
import { addStandardTags } from "../config/tags";

export interface EcrConstructProps {
  envName: string;
  naming?: NamingConfig;
  /** If true, import existing repository instead of creating new one */
  importExisting?: boolean;
}

export class EcrConstruct extends Construct {
  public readonly repository: ecr.IRepository;

  constructor(scope: Construct, id: string, props: EcrConstructProps) {
    super(scope, id);

    const { envName, naming, importExisting } = props;

    // Generate names based on naming config (ECR is global resource)
    const n = naming ? createNamingHelper(naming) : null;
    const repoName = n
      ? n.globalName(ResourceTypes.ECR, "backend", "01")
      : `gsf-${envName}-backend`;

    const isProd = envName === "prod" || envName === "prd";

    if (importExisting) {
      // Import existing repository (useful when repo was created outside CDK)
      this.repository = ecr.Repository.fromRepositoryName(
        this,
        "Repository",
        repoName
      );
    } else {
      // Create new repository
      const newRepo = new ecr.Repository(this, "Repository", {
        repositoryName: repoName,
        imageScanOnPush: true,
        imageTagMutability: ecr.TagMutability.MUTABLE,
        removalPolicy: isProd
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
        emptyOnDelete: !isProd,
        lifecycleRules: [
          {
            description: "Keep last 10 images",
            maxImageCount: 10,
            rulePriority: 1,
            tagStatus: ecr.TagStatus.ANY,
          },
        ],
      });

      // Tags (only for newly created repos)
      if (naming) {
        addStandardTags(newRepo, naming.env);
      } else {
        cdk.Tags.of(newRepo).add("Environment", envName);
        cdk.Tags.of(newRepo).add("ManagedBy", "CDK");
      }

      this.repository = newRepo;
    }
  }
}
