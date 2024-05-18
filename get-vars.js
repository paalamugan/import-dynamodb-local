#! /usr/bin/env node

/**
 * This script will get all the environment variables from all the Lambda functions in a CloudFormation stack.
 * 
 * How to use:
 * 
 * 1. Install the AWS SDK for JavaScript:
 * 
 * ```bash
 * npm install @aws-sdk/client-cloudformation @aws-sdk/client-lambda
 * ```
 * 
 * 2. Run the script: (replace `MyStackName` with the name of your sam project stack name or cloudformation)
 * 
 * Make sure ./get-vars.js is executable file (chmod +x ./get-vars.js) and run the following command:
 * 
 * ```bash
 * ./get-vars.js MyStackName locals.json
 * ```
 * 
 * If not executable, you can run the following command:
 * 
 * ```bash
 * node ./get-vars.js MyStackName locals.json
 * ```
 * 
 * The script will output all the environment variables from all the Lambda functions in the stack.
 * 
 * 
 */

const { CloudFormation } = require('@aws-sdk/client-cloudformation');
const { Lambda } = require('@aws-sdk/client-lambda');

const fs = require('fs');
const process = require('process');

let functionCount = 0;
let merged = {};
let stacks = {};

const cloudformation = new CloudFormation({ region: 'us-east-1', profile: 'default' });
const lambda = new Lambda();

if (process.argv.length <= 2) {
    console.error('CloudFormation stack required!');
    process.exit();
}

const stackName = process.argv[2];
const output = process.argv[3];

async function listStackResources(stackName, nested = true) {
    let page = {};

    const stackResources = await cloudformation.listStackResources({ StackName: stackName });

    for (let resource of stackResources.StackResourceSummaries) {
        if (resource.ResourceType === 'AWS::CloudFormation::Stack' && nested) {
            let nestedStack = resource.PhysicalResourceId.split('/')[1];
            await listStackResources(nestedStack);
        }

        if (resource.ResourceType === 'AWS::Lambda::Function') {
            functionCount++;
            const lambdaConfig = await lambda.getFunctionConfiguration({ FunctionName: resource.PhysicalResourceId });

            if (lambdaConfig.Environment && lambdaConfig.Environment.Variables) {
                page[resource.LogicalResourceId] = lambdaConfig.Environment.Variables;
                merged = { ...merged, ...lambdaConfig.Environment.Variables };
            }
        }
    }

    console.log(`completed stack: ${stackName}`);
    console.log(`functionCount: ${functionCount}`);

    if (Object.keys(page).length !== 0) {
        stacks[stackName] = page;
    }
}

listStackResources(stackName)
    .then(() => {
        console.log(JSON.stringify(merged, null, 2));

        if (output) {
            fs.writeFile(output, JSON.stringify({ Parameters: merged }, null, 2), (err) => {
                if (err) {
                    console.error(err);
                } else {
                    console.log("Write successful");
                }
            });
        }
    })
    .catch(console.error);