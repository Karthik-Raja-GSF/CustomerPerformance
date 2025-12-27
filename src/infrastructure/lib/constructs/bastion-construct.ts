import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import {
  NamingConfig,
  createNamingHelper,
  ResourceTypes,
} from "../config/naming";
import { addStandardTags } from "../config/tags";

export interface BastionConstructProps {
  envName: string;
  vpc: ec2.IVpc;
  naming: NamingConfig;
}

export class BastionConstruct extends Construct {
  public readonly instance: ec2.Instance;
  public readonly securityGroup: ec2.SecurityGroup;
  public readonly keyPair: ec2.KeyPair;
  public readonly elasticIp: ec2.CfnEIP;

  constructor(scope: Construct, id: string, props: BastionConstructProps) {
    super(scope, id);

    const { envName, vpc, naming } = props;

    // Generate resource names
    const n = createNamingHelper(naming);
    const sgName = n.name(ResourceTypes.SECURITY_GROUP, "bastion", "01");
    const instanceName = n.name(ResourceTypes.EC2, "bastion", "01");
    const keyPairName = n.name(ResourceTypes.KEY_PAIR, "bastion", "01");
    const eipName = n.name(ResourceTypes.EIP, "bastion", "01");

    // Security group for bastion - allow SSH from anywhere
    this.securityGroup = new ec2.SecurityGroup(this, "SecurityGroup", {
      vpc,
      securityGroupName: sgName,
      description: `Security group for AIT ${envName} Bastion Host - SSH access`,
      allowAllOutbound: true,
    });

    // Allow SSH from anywhere (0.0.0.0/0) per user preference
    this.securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      "Allow SSH access from anywhere"
    );

    // Use CDK's native KeyPair - stores private key in SSM Parameter Store
    // Key is stored at /ec2/keypair/<keypair-id> as SecureString
    this.keyPair = new ec2.KeyPair(this, "KeyPair", {
      keyPairName: keyPairName,
      type: ec2.KeyPairType.RSA,
      format: ec2.KeyPairFormat.PEM,
    });

    // Create bastion EC2 instance
    this.instance = new ec2.Instance(this, "Instance", {
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: this.securityGroup,
      keyPair: this.keyPair,
      instanceName: instanceName,
      associatePublicIpAddress: true,
    });

    // Create Elastic IP for stable public address
    this.elasticIp = new ec2.CfnEIP(this, "ElasticIP", {
      domain: "vpc",
      instanceId: this.instance.instanceId,
      tags: [{ key: "Name", value: eipName }],
    });

    // Tags
    addStandardTags(this.securityGroup, naming.env, sgName);
    addStandardTags(this.instance, naming.env, instanceName);
  }

  /**
   * Get the public IP address (Elastic IP)
   */
  public getPublicIp(): string {
    return this.elasticIp.attrPublicIp;
  }

  /**
   * Get the SSM Parameter Store path for the private key
   * Retrieve with: aws ssm get-parameter --name <path> --with-decryption
   */
  public getPrivateKeyParameterName(): string {
    return `/ec2/keypair/${this.keyPair.keyPairId}`;
  }
}
