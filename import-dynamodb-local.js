#!/usr/bin/env node

const { DynamoDBClient, DescribeTableCommand, ScanCommand, CreateTableCommand, BatchWriteItemCommand } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const { hideBin } = require('yargs/helpers');
const yargs = require("yargs")(hideBin(process.argv));

const argv = yargs
.usage('Usage: node import-dynamodb-local --table-name <table-name>')
.version(false)
.option('table-name', {
  alias: 't',
  describe: 'The name of the remote DynamoDB table',
  type: 'string',
})
.option('region', {
  alias: 'r',
  describe: 'The region of the remote DynamoDB table',
  type: 'string',
  default: 'us-east-1',
  defaultDescription: 'Default remote region is us-east-1',
})
.option('remote-endpoint', {
  alias: 'e',
  describe: 'The remote endpoint of the could DynamoDB table',
  type: 'string',
})
.option('local-endpoint', {
  alias: 'e',
  describe: 'The local endpoint of the local DynamoDB table',
  type: 'string',
  default: 'http://localhost:8000',
  defaultDescription: 'Default local DynamoDB endpoint is http://localhost:8000',
})
.option('limit', {
  alias: 'l',
  describe: 'The limit of items to export and import',
  type: 'number',
  default: 500,
  defaultDescription: 'Default limit is 500 items, set to 0 to export and import all items',
})
.help('help', 'Show help')
.alias('help', 'h')
.demandOption(['table-name'], 'Please provide the name of the remote DynamoDB table')
.parse(); 

// Configure AWS SDK
const tableName = argv.tableName; // remote table name
const region = argv.region || 'us-east-1'; // remote region
const localEndpoint = argv.localEndpoint || 'http://localhost:8000'; // local endpoint
const remoteEndpoint = argv.remoteEndpoint; // remote endpoint
const limit = argv.limit ?? 500; // limit of items to export and import


const dynamodbClient = new DynamoDBClient({ region, endpoint: remoteEndpoint });
const dynamodbDocClient = DynamoDBDocumentClient.from(dynamodbClient);

const dynamodbLocalClient = new DynamoDBClient({ region, endpoint: localEndpoint });
const dynamodbLocalDocClient = DynamoDBDocumentClient.from(dynamodbLocalClient);

/**
 * A generator function that chunks an array into smaller arrays of a specified size.
 *
 * @param {Array} arr - The array to be chunked.
 * @param {number} [stride=1] - The size of each chunk. Defaults to 1.
 * @yields {Array} - A chunk of the original array.
 */
function* chunkArray(arr, stride = 1) {
  for (let i = 0; i < arr.length; i += stride) {
    yield arr.slice(i, Math.min(i + stride, arr.length));
  }
}

/**
 * Retrieves the description of a DynamoDB table.
 *
 * @param {string} tableName - The name of the table to describe.
 * @param {DynamoDBDocumentClient} documentClient - The DynamoDB DocumentClient instance.
 * @returns {Promise<any|null>} The description of the table, or null if the table does not exist.
 * @throws {Error} If there is an error while describing the table (other than ResourceNotFoundException).
 */
async function getTableDescriptionInfo(tableName, documentClient) {
  try {
    // Describe the table structure
    const describeTableCommand = new DescribeTableCommand({ TableName: tableName });
    return await documentClient.send(describeTableCommand);
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') {
      return null;
    }
    throw err;
  }
}

/**
 * Imports remote data to local DynamoDB.
 * @param {Array} items - The array of items to import.
 * @returns {Promise<void>} - A promise that resolves when the import is complete.
 */
async function importRemoteDataToLocalDynamoDB(items) {
  // chunkArray is a local convenience function. It takes an array and returns
  // a generator function. The generator function yields every N items.

  const stride = limit > 25 ? 25 : limit;
  const itemChunks = chunkArray(items, stride);
  let limitCounter = 0;

  // For every chunk of 25 items, make one BatchWrite request.
  for (const items of itemChunks) {
    const putRequests = items.map((item) => ({ PutRequest: { Item: item } }));
    const batchWriteCommand = new BatchWriteItemCommand({
      RequestItems: {
        [tableName]: putRequests,
      },
    });

    await dynamodbLocalDocClient.send(batchWriteCommand);
    limitCounter += items.length;

    // If the limit is reached, stop importing items.
    if (limitCounter >= limit) {
      break;
    }
  }
}

/**
 * Export and import a DynamoDB table from remote DynamoDB to local DynamoDB.
 * @returns {Promise<void>} A promise that resolves when the export and import process is complete.
 */
async function exportAndImportDynamoDBTable() {
  console.log('Exporting and importing DynamoDB table from remote DynamoDB to local DynamoDB...\n');

  try {
    // Check if the table exists in remote DynamoDB
    const remoteTableDescription = await getTableDescriptionInfo(tableName, dynamodbDocClient);

    if (!remoteTableDescription) {
      throw new Error(`Table "${tableName}" does not exist in the remote DynamoDB, Please create the table first before exporting and importing it to local DynamoDB.`);
    }

    const localTableDescription = await getTableDescriptionInfo(tableName, dynamodbLocalDocClient);

    // Check if the table exists in local DynamoDB, if not create the table locally
    if (!localTableDescription) {
      const createTableCommand = new CreateTableCommand(remoteTableDescription.Table);
      await dynamodbLocalDocClient.send(createTableCommand);
    }

    // Scan the remote table data
    const scanCommand = new ScanCommand({ TableName: tableName });
    const tableData = await dynamodbClient.send(scanCommand);

    // Check if the table is empty in remote DynamoDB
    if (!tableData.Items ||  !tableData.Items.length) {
      return console.log(`Table ${tableName} is empty, no data to export and import to local DynamoDB`);
    }

    // Import the remote table data to local DynamoDB
    await importRemoteDataToLocalDynamoDB(tableData.Items);
    console.log(`Table "${tableName}" exported from remote DynamoDB and imported to local DynamoDB successfully!`);
  } catch (err) {
    console.error(err);
  }
}

exportAndImportDynamoDBTable();