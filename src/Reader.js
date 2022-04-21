const fs = require('fs');
const Tail = require('tail').Tail;
const EventEmitter = require('events');

class Reader extends EventEmitter {
  constructor(K8S_AUDIT_LOG = '/var/log/kubernetes/audit.log') {
    super();
    this.K8S_AUDIT_LOG = K8S_AUDIT_LOG;
    this.nextSequenceToken = null;
    this.status = {
      audit_log_availble: false,
      audit_log_tailing: false,
      audit_log_last_read: 0,
      audit_log_error: ""
    }
    this.counter_events = 0;
    this.events = [];
  }

  startTailing() {
    this.interval_tailing = setInterval(() => {
      let _timestamp = new Date().getTime();

      if(this.events.length>0) {
        this.emit("events",this.events);
        this.events = [];
      }
      if(this.status.audit_log_tailing) return;
  
      if(fs.existsSync(this.K8S_AUDIT_LOG)) {
        console.log("Tailing audit file: "+this.K8S_AUDIT_LOG);
        try {
          let tail = new Tail(this.K8S_AUDIT_LOG, {
            fromBeginning: true,
            flushAtEOF: true,
            follow: false
          });
          this.status.audit_log_tailing=true;
          tail.on("line", (data) => {
            this.status.audit_log_last_read=_timestamp;
            this.events.push(data);
          });
          tail.on("error", (error) => {
            this.status.audit_log_error = error.toString();
            this.status.audit_log_tailing=false;
          });
        } catch(e) {
          this.status.audit_log_tailing=false;
        }
      } else {
        this.status.audit_log_error = "file does not exist "+this.K8S_AUDIT_LOG;
      }
    }, 1000);
  }
}

module.exports = Reader;