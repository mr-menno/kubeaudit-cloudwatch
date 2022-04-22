const express = require('express');
const bodyParser = require('body-parser');
const Reader = require('./Reader');
const KubeApi = require('./KubeApi');
const CloudWatchShipper = require('./CloudWatchShipper.js');
// let cw = require('./cloudwatch.js');
const os = require('os');
let kubeapi = new KubeApi();
let cws = new CloudWatchShipper({
  logGroup: process.env.CLOUDWATCH_LOGGROUP,
  //logStream: **this is dynamically generated if not set**
});

const app = express();
let status = {};

//validate environment variables
const K8S_AUDIT_LOG=process.env.K8S_AUDIT_LOG || "/var/log/kubernetes/audit.log";

let reader = new Reader(K8S_AUDIT_LOG)

app.use(bodyParser.json());

app.get('/status', async (req,res) => {
  let kubeapi_validate = await kubeapi.validate();
  res.json({
    ...status,
    ...reader.status,
    ...await kubeapi.validate(),
    ...cws.status,
  });
})

app.listen(4516,() => {
  console.log("📡 listening for audit events");
});

kubeapi.validate().then(validation => {
  if(validation.kubeapi_errors.length===0) {
    console.log("kube api successfully validated")
    reader.startTailing();
  } else {
    validation.kubeapi_errors.forEach(error => {
      console.error("kubeapi validation error: "+error);
    });
  }
})

reader.on('events', (events) => {
  events.forEach(event => cws.sendEvent(event));
})

process.on('SIGINT', () => {
  console.warn('terminating app');
  process.exit(0);
});