const express = require('express');
const path = require('path');
require('dotenv').config();
const app = express(),
      bodyParser = require("body-parser");
      port = process.env.PORT || 3080;
      const { BlobServiceClient, BaseRequestPolicy, newPipeline, AnonymousCredential } = require("@azure/storage-blob");


app.use(bodyParser.json());

const account = process.env.ACCOUNT_NAME || "";
const SAS = process.env.SAS || "";


// Create a policy factory with create() method provided
class RequestIDPolicyFactory {
  // Constructor to accept parameters
  constructor(prefix) {
    this.prefix = prefix;
  }

  // create() method needs to create a new RequestIDPolicy object
  create(nextPolicy, options) {
    return new RequestIDPolicy(nextPolicy, options, this.prefix);
  }
}

// Create a policy by extending from BaseRequestPolicy
class RequestIDPolicy extends BaseRequestPolicy {
  constructor(nextPolicy, options, prefix) {
    super(nextPolicy, options);
    this.prefix = prefix;
  }

  // Customize HTTP requests and responses by overriding sendRequest
  // Parameter request is WebResource type
  async sendRequest(request) {
    // Customize client request ID header
    request.headers.set(
      "x-ms-version",
      `2020-02-10`
    );

    // response is HttpOperationResponse type
    const response = await this._nextPolicy.sendRequest(request);

    // Modify response here if needed

    return response;
  }
}

const pipeline = newPipeline(new AnonymousCredential());

// Inject customized factory into default pipeline
pipeline.factories.unshift(new RequestIDPolicyFactory("Prefix"));

  const blobServiceClient = new BlobServiceClient(
    `https://${account}.blob.core.windows.net${SAS}`,
    pipeline
  );


app.get('/api/containers', async (req, res) => {

  let i = 1;
  const constainers = [];
  try {
    for await (const container of blobServiceClient.listContainers()) {
      console.log(`Container ${i++}: ${container.name}`);
      console.log(container);
      constainers.push(container.name)
    }
  }catch(err) {
    console.error("err:::", err);
  }
  res.json(constainers);
});


app.post('/api/container', async (req, res) => {

  const containerName = `${req.body.containerName}${new Date().getTime()}`;
  let requestId = ''
  try {
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const createContainerResponse = await containerClient.create();
    console.log(`Create container ${containerName} successfully`, createContainerResponse.requestId);
    requestId = createContainerResponse.requestId;
  }catch(err) {
    console.error("err:::", err);
  }
  res.json({requestId, containerName});
});


app.delete('/api/container/:containerName', async (req, res) => {

  const containerName = req.params.containerName;
  console.log('containerName:::', containerName)
  let requestId = ''
  try {
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const createContainerResponse = await containerClient.deleteIfExists();
    console.log(`Delete container ${containerName} successfully`, createContainerResponse.requestId);
    requestId = createContainerResponse.requestId;
  }catch(err) {
    console.error("err:::", err);
  }
  res.json({requestId, containerName});
});


app.get('/api/folders/:conatinerName', async (req, res) => {
  
  let result = [];
  const containerClient = blobServiceClient.getContainerClient(req.params.conatinerName);

  for await (const item of containerClient.listBlobsByHierarchy("/")) {
    if (item.kind === "prefix") {
      console.log(`\tBlobPrefix: ${item.name}`);
      result.push(item.name)
    } else {
      console.log(`\tBlobItem: name - ${item.name}, last modified - ${item.properties.lastModified}`);
    }
  } 
  res.json(result);
});


app.get('/api/blobs/:conatinerName', async (req, res) => {

  let result = [];
  const containerClient = blobServiceClient.getContainerClient(req.params.conatinerName);
  
  try{
    let blobs = containerClient.listBlobsFlat();
    for await (const blob of blobs) {
      result.push(blob.name)
    }
  }catch(err) {
    console.error("err:::", err);
  }
  res.json(result);
});


app.post('/api/blob/', async (req, res) => {

  const containerName = req.body.containerName
  const content = req.body.content
  const containerClient = blobServiceClient.getContainerClient(containerName);
  let requestId = '';
  let name = '';
  try{
    const blobName = "conatiner1blob";
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    const uploadBlobResponse = await blockBlobClient.upload(content, content.length);
    console.log(`Upload block blob ${blobName} successfully`, uploadBlobResponse.requestId);
    requestId = uploadBlobResponse.requestId;
    name = blobName;
  }catch(err) {
    console.error("err:::", err);
  }
  res.json({requestId, blobName: name});
});

app.get('/api/blob/:containerName/:blobName', async (req, res) => {

  const containerName = req.params.containerName
  const blobName = req.params.blobName
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blobClient = containerClient.getBlobClient(blobName);

  // Get blob content from position 0 to the end
  // In Node.js, get downloaded data by accessing downloadBlockBlobResponse.readableStreamBody
  const downloadBlockBlobResponse = await blobClient.download();
  const downloaded = (
    await streamToBuffer(downloadBlockBlobResponse.readableStreamBody)
  ).toString();
  console.log("Downloaded blob content:", downloaded);

  async function streamToBuffer(readableStream) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      readableStream.on("data", (data) => {
        chunks.push(data instanceof Buffer ? data : Buffer.from(data));
      });
      readableStream.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
      readableStream.on("error", reject);
    });
  }
  res.json({content: downloaded});
});


app.delete('/api/blob/:containerName/:blobName', async (req, res) => {

  const containerName = req.params.containerName
  const blobName = req.params.blobName
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blobClient = containerClient.getBlobClient(blobName);

  // Get blob content from position 0 to the end
  // In Node.js, get downloaded data by accessing downloadBlockBlobResponse.readableStreamBody
  const response = await blobClient.deleteIfExists();
  console.log(response.requestId)
  res.json({requestId: response.requestId});
});


app.get('/', (req,res) => {
  res.send("API Works!!");
});

app.listen(port, () => {
    console.log(`Server listening on the port::${port}`);
});