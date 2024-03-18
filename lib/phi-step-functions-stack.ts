import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as stepfunctionsTasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import * as dotenv from 'dotenv';
dotenv.config();

export class PhiStepFunctionsStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        if (typeof process.env.OPENAI_API_KEY !== 'string') {
            throw new Error('OPENAI_API_KEY environment variable is not set');
        }

        // Define a policy statement that allows invoking the zendeskRetriever Lambda function
        const PolicyStatement = new iam.PolicyStatement({
            actions: ['lambda:InvokeFunction'],
            resources: ['*'], // Replace <region> and <account> with actual valuesy
        });

        // Define the IAM role for openaiRetriever
        const RetrieverRole = new iam.Role(this, 'RetrieverRole', {
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: 'IAM role for openaiRetriever Lambda function',
        });

        // Attach the policy statement to the role
        RetrieverRole.addToPolicy(PolicyStatement);

        // Create an S3 bucket
        const timeSeriesDataBucket = new s3.Bucket(this, 'timeSeriesDataBucket', {
            // Bucket configuration options as needed
            removalPolicy: cdk.RemovalPolicy.DESTROY, // Automatically delete bucket when the stack is deleted
            autoDeleteObjects: true, // Automatically delete objects within the bucket when the bucket is deleted
        });

        // Define a policy statement that allows reading objects from the S3 bucket
        const s3ReadPolicyStatement = new iam.PolicyStatement({
            actions: ['s3:GetObject', 's3:ListBucket'],
            resources: [timeSeriesDataBucket.bucketArn, `${timeSeriesDataBucket.bucketArn}/*`], // Grant access to the bucket and its contents
        });

        // Attach the S3 read policy statement to the RetrieverRole
        RetrieverRole.addToPolicy(s3ReadPolicyStatement);

        // Define the openaiRetriever Lambda function and assign the created role
        const managerDataAgent = new lambda.DockerImageFunction(this, "managerDataAgent", {
            code: lambda.DockerImageCode.fromImageAsset("./api/manager_data_agent"),
            memorySize: 3008,
            timeout: cdk.Duration.seconds(300),
            architecture: lambda.Architecture.ARM_64,
            environment: {
                OPENAI_API_KEY: process.env.OPENAI_API_KEY,
            },
            role: RetrieverRole, // Assign the custom role to the Lambda function
        });


        const managerDataUrl = managerDataAgent.addFunctionUrl({
            authType: lambda.FunctionUrlAuthType.NONE,
            cors: {
                allowedMethods: [lambda.HttpMethod.ALL],
                allowedHeaders: ["*"],
                allowedOrigins: ["*"],
            },
        });

        // Define Step Functions tasks to invoke managerDataAgent twice
        const managersInitialResponseStep = new stepfunctionsTasks.LambdaInvoke(this, 'Managers Initial Response', {
            lambdaFunction: managerDataAgent,
            payload: stepfunctions.TaskInput.fromObject({
                "body": stepfunctions.JsonPath.stringAt('$.body'), // Pass the original event body
                "stage": "initial" // Specify the stage
            }),
            outputPath: '$.Payload',
        });

        const managersFollowUpStep = new stepfunctionsTasks.LambdaInvoke(this, 'Managers Follow-Up', {
            lambdaFunction: managerDataAgent,
            payload: stepfunctions.TaskInput.fromObject({
                "body": stepfunctions.JsonPath.stringAt('$.body'), // Pass the original event body
                "stage": "followUp" // Specify the stage for follow-up
            }),
            outputPath: '$.Payload',
        });

        // Chain the steps
        const definition = managersInitialResponseStep.next(managersFollowUpStep);

        // Create the state machine
        const stateMachine = new stepfunctions.StateMachine(this, 'StateMachine', {
            definition,
            stateMachineType: stepfunctions.StateMachineType.STANDARD,
        });

        // Output the State Machine's ARN for reference
        new cdk.CfnOutput(this, 'StateMachineArn', {
            value: stateMachine.stateMachineArn,
        });

        new cdk.CfnOutput(this, "managerDataUrl", {
            value: managerDataUrl.url,
        });

        new cdk.CfnOutput(this, "timeSeriesDataBucketName", {
            value: timeSeriesDataBucket.bucketName,
        });
    }
}
