#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BackendStack } from '../lib/backend-stack';

const app = new cdk.App();

new BackendStack(app, 'GsfBackendStack', {
  env: {
    account: '201002506909',
    region: 'us-east-1',
  },
  description: 'GSF Backend Infrastructure - ECS Fargate with ALB',
});
