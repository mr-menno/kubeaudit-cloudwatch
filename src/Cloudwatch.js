// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');

if(!process.env.AWS_REGION || !process.env.AWS_SECRET_ACCESS_KEY || !process.env.AWS_ACCESS_KEY_ID) {
  console.error("Missing AWS variables");
  process.exit(1);
}

function cloudWatchPutLogEvents(events,group,stream,sequenceToken) {
  return new Promise((resolve,reject) => {
    const cloudwatchlogs = new AWS.CloudWatchLogs();
    var params = {
      logEvents: events,
      logGroupName: group,
      logStreamName: stream,
      sequenceToken: sequenceToken
    };
    cloudwatchlogs.putLogEvents(params, function(err,data) {
      if(err) return reject(err);
      resolve(data);
    });
  });
}

function cloudWatchDescribeLogStreams(group,stream) {
  return new Promise((resolve, reject) => {
    const cloudwatchlogs = new AWS.CloudWatchLogs();
    var params = {
      logGroupName: group,
    };
    cloudwatchlogs.describeLogStreams(params, (err,data) => {
      if(err) return reject(err);
      let logStream = data.logStreams.find(ls=>ls.logStreamName==stream);
      console.log("Log Group: ",group);
      if(logStream) {
        console.log("Log Stream found: ",stream,logStream);
        return resolve(logStream);
      }

      console.log("Creating logstream: ",stream)
      cloudwatchlogs.createLogStream({logGroupName: group, logStreamName: stream}, (err,data) => {
        if(err) return reject(err);
        resolve(stream);
        console.log("createLogStream result",data);
      });
      
    });
  });
}

module.exports = {
  cloudWatchPutLogEvents,
  cloudWatchDescribeLogStreams
}
