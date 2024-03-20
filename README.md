# Phi Data Assistants AWS serverless

Phidata is a toolkit for building AI Assistants using function calling.

This project shows how you can preform autonomous data analysis using AI function calling running serverlessly in AWS:

1. User sends s3 file location and question
2. Data scientist reviews the question and provides steps to a python developer on how to preform the analysis
3. Python developer answers the question using the steps provided by data scientist

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template
