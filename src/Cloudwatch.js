// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');

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
      console.log(logStream);
      if(logStream) return resolve(logStream);

      cloudwatchlogs.createLogStream({logGroupName: group, logStreamName: stream}, (err,data) => {
        if(err) return reject(err);
        console.log(data);
      });
      
    });
  });
}

module.exports = {
  cloudWatchPutLogEvents,
  cloudWatchDescribeLogStreams
}
