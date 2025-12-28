import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as cr from "aws-cdk-lib/custom-resources";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { VpcPeeringConfig } from "../config/environments";
import {
  NamingConfig,
  createNamingHelper,
  ResourceTypes,
} from "../config/naming";
import { getStandardTagsObject } from "../config/tags";

export interface VpcPeeringConstructProps {
  vpc: ec2.IVpc;
  config: VpcPeeringConfig;
  naming: NamingConfig;
}

export class VpcPeeringConstruct extends Construct {
  public readonly peeringConnectionId: string;

  constructor(scope: Construct, id: string, props: VpcPeeringConstructProps) {
    super(scope, id);

    const { vpc, config, naming } = props;

    // Generate resource name
    const n = createNamingHelper(naming);
    const peeringName = n.name(ResourceTypes.VPC_PEERING, "peer", "01");

    // Build tags array for createTags API
    const standardTags = getStandardTagsObject(naming.env);
    const tags = [
      { Key: "Name", Value: peeringName },
      { Key: "Company", Value: standardTags.Company },
      { Key: "Project", Value: standardTags.Project },
      { Key: "ProjectAbbr", Value: standardTags.ProjectAbbr },
      { Key: "Environment", Value: standardTags.Environment },
      { Key: "Owner", Value: standardTags.Owner },
      { Key: "CostCenter", Value: standardTags.CostCenter },
      { Key: "ManagedBy", Value: standardTags.ManagedBy },
    ];

    // Create VPC Peering Connection using Custom Resource due to bug in cdk https://github.com/hashicorp/terraform-provider-aws/issues/30423
    const createPeering = new cr.AwsCustomResource(this, "CreatePeering", {
      onCreate: {
        service: "EC2",
        action: "createVpcPeeringConnection",
        parameters: {
          VpcId: vpc.vpcId,
          PeerVpcId: config.peerVpcId,
          PeerOwnerId: config.peerAccountId,
          PeerRegion: config.peerRegion,
          TagSpecifications: [
            {
              ResourceType: "vpc-peering-connection",
              Tags: tags,
            },
          ],
        },
        physicalResourceId: cr.PhysicalResourceId.fromResponse(
          "VpcPeeringConnection.VpcPeeringConnectionId"
        ),
      },
      onDelete: {
        service: "EC2",
        action: "deleteVpcPeeringConnection",
        parameters: {
          VpcPeeringConnectionId: new cr.PhysicalResourceIdReference(),
        },
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: [
            "ec2:CreateVpcPeeringConnection",
            "ec2:DeleteVpcPeeringConnection",
            "ec2:DescribeVpcPeeringConnections",
            "ec2:CreateTags",
          ],
          resources: ["*"],
        }),
      ]),
    });

    this.peeringConnectionId = createPeering.getResponseField(
      "VpcPeeringConnection.VpcPeeringConnectionId"
    );

    // Only create routes if the peering connection has been accepted
    if (config.accepted) {
      // Add routes to private subnets
      vpc.privateSubnets.forEach((subnet, i) => {
        new ec2.CfnRoute(this, `PrivateRoute${i + 1}`, {
          routeTableId: subnet.routeTable.routeTableId,
          destinationCidrBlock: config.peerVpcCidr,
          vpcPeeringConnectionId: this.peeringConnectionId,
        });
      });

      // Add routes to isolated subnets
      vpc.isolatedSubnets.forEach((subnet, i) => {
        new ec2.CfnRoute(this, `IsolatedRoute${i + 1}`, {
          routeTableId: subnet.routeTable.routeTableId,
          destinationCidrBlock: config.peerVpcCidr,
          vpcPeeringConnectionId: this.peeringConnectionId,
        });
      });
    }
  }
}
