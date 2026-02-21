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
  naming: NamingConfig;
  /** If true, import existing repository instead of creating new one */
  importExisting?: boolean;
}

export class EcrConstruct extends Construct {
  public readonly repository: ecr.IRepository;
  public readonly webappRepository: ecr.IRepository;

  constructor(scope: Construct, id: string, props: EcrConstructProps) {
    super(scope, id);

    const { envName, naming, importExisting } = props;

    // Generate resource names (ECR is global resource)
    const n = createNamingHelper(naming);
    const repoName = n.globalName(ResourceTypes.ECR, "backend", "01");
    const webappRepoName = n.globalName(ResourceTypes.ECR, "webapp", "01");

    const isProd = envName === "prod" || envName === "prd";

    if (importExisting) {
      // Import existing repositories (useful when repos were created outside CDK)
      this.repository = ecr.Repository.fromRepositoryName(
        this,
        "Repository",
        repoName
      );
      this.webappRepository = ecr.Repository.fromRepositoryName(
        this,
        "WebappRepository",
        webappRepoName
      );
    } else {
      // Create backend repository
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
      addStandardTags(newRepo, naming.env, repoName);

      this.repository = newRepo;

      // Create webapp repository
      const newWebappRepo = new ecr.Repository(this, "WebappRepository", {
        repositoryName: webappRepoName,
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

      addStandardTags(newWebappRepo, naming.env, webappRepoName);

      this.webappRepository = newWebappRepo;
    }
  }
}
