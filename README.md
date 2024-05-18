# Import AWS Dynamodb data into local

## Pre-requisites

1. To Install aws-cli, follow the instructions at [https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html]()
2. To Install aws-sam-cli, follow the instructions at [https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html]()
3. To Install Docker, follow the instructions at [https://docs.docker.com/get-docker/]()
4. To install NoSQL Workbench, follow the instructions at [https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/workbench.settingup.html]()

- Run the Below Command to export remote Dynamodb data and import into local dynamodb

```sh
node ./import-dynamodb-local --table-name <your-remote-dynamodb-table-name>
```

- Pull Lambda Function Env Variables from the AWS cloud for SAM APP Local Testing

```sh
node ./get-vars locals.json
```
