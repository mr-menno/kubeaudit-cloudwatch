let Cloudwatch = require('./Cloudwatch.js');
const os = require('os');
let crypto=require('crypto');

class CloudWatchShipper {
  constructor(options) {
    let {logGroup,logStream} = options||{};
    this.logGroup = logGroup;

    //to meet Lacework EKS audit filtering, the following logstream name needs to be defined
    //similiar to EKS audit log streams.  (md5 of hostname used to generate logstream)
    // i.e. kube-apiserver-audit-a8ba83385133f5b3082cec63dedc0000
    this.logStream = logStream || "kube-apiserver-audit-"+crypto.createHash('md5').update(os.hostname()).digest('hex');
    this.eventQueue = [];
    this.nextSequenceToken = null;
    this.sending = false;
    this.last = new Date().getTime();
    this.minInterval = 30*1000;
    this.eventId = 0;
    console.log(`CloudWatchShipper ready for group:${this.logGroup} stream:${this.logStream}`);
    this.startSending();
    this.status = {
      cloudwatch_sent: 0
    };
  }

  sendEvent(event) {
    this.eventQueue.push(event);
  }

  startSending() {
    this.intervalSending = setInterval(async () => {
      if(this.sending) return;
      this.sending=true;
      let events_slice=[];
      if(this.eventQueue.length>10 || (this.last+this.minInterval)>(new Date().getTime())) {
        while(this.eventQueue.length>0) {
          for(let i=0;i<100;i++) {
            if(this.eventQueue.length==0) break;
            events_slice.push(this.eventQueue.shift());
          }
          console.log(`sendEvents() sending ${events_slice.length}/${this.eventQueue.length}`);
          try {
            await this.sendEvents(events_slice);
            events_slice = [];
          } catch(e) {
            console.error('sendEvents error',e);
          }
        }
        this.sending=false;
      } else {
        this.sending=false;
      }
    }, 1000);
  }

  async sendEvents(events) {
    let res;
    if(this.nextSequenceToken == null) {
      console.log(`Requesting cloudWatchDescribeLogStreams group:${this.logGroup} stream:${this.logStream}`)
      let res = await Cloudwatch.cloudWatchDescribeLogStreams(this.logGroup,this.logStream);
      this.nextSequenceToken = res.uploadSequenceToken || null;
    }
    //262144 is cloud watch event size limit
    events = events
    .filter(e=>e.length<262144)
    .map(e=>({
      message: e,
      timestamp: new Date().getTime()
    }));
    try {
      res = await Cloudwatch.cloudWatchPutLogEvents(
        events,
        this.logGroup,
        this.logStream,
        this.nextSequenceToken
      );
      this.status.cloudwatch_sent += events.length;
      this.nextSequenceToken = res.nextSequenceToken;
    } catch(e) {
      console.error("cws-sendEvents() [ERROR]",e.toString());
    }
  }
}

module.exports = CloudWatchShipper;