const axios = require('axios');
const https = require('https');
const fs = require('fs');

class KubeApi {
  constructor() {
    this.SERVICEACCOUNT='';
    this.NAMESPACE='';
    this.TOKEN='';
    this.CACERT='';
  }

  kubeapiOptions = () => {
    let options = {};
    if(this.TOKEN) {
      options.headers = {
        Authorization: "Bearer "+this.TOKEN
      }
    }
    if(this.CACERT) {
      options.httpsAgent = new https.Agent({
        ca: this.CACERT
      })
    }
    return options;
  }

  async validate() {
    let validation = {errors:[]};

    try {
      this.KUBERNETES_API = process.env.KUBERNETES_API || 'https://kubernetes.default.svc';
      this.SERVICEACCOUNT='/var/run/secrets/kubernetes.io/serviceaccount';
      this.NAMESPACE=fs.readFileSync(this.SERVICEACCOUNT+'/namespace').toString();
      this.TOKEN=fs.readFileSync(this.SERVICEACCOUNT+'/token').toString();
      this.CACERT=fs.readFileSync(this.SERVICEACCOUNT+'/ca.crt');
      if(!https.globalAgent.options) https.globalAgent.options = {ca:[]}
      https.globalAgent.options.ca.push(this.CACERT);
    } catch(e) {
      validation.errors.push("Cannot read K8s API credentials");
      console.error('Cannot read K8s API credentials',e)
      return {
        kubeapi_errors: validation.errors
      }
    }

    let kubeapiNodes;
    try {
      kubeapiNodes = await axios.get(this.KUBERNETES_API+'/api/v1/namespaces/kube-system/pods?labelSelector=component%3Dkube-apiserver', {
        ...this.kubeapiOptions()
      })
    } catch(e) {
      validation.errors.push("API request "+e.toString());
      return {
        kubeapi_errors: validation.errors
      }
    }
    kubeapiNodes = kubeapiNodes.data.items;
    validation.api_nodes = kubeapiNodes.map(i => ({
      name: i.metadata.name,
      audit_policy: (i.spec.containers[0].command.find(c=>c.match(/--audit-policy-file/))||"").split("=")[1]||"",
      audit_log_path: (i.spec.containers[0].command.find(c=>c.match(/--audit-log-path/))||"").split("=")[1]||"",
      audit_webhook: (i.spec.containers[0].command.find(c=>c.match(/--audit-webhook-config-file/))||"").split("=")[1]||""
    }));

    //determine if kube_api policy is available on each node
    if(validation.api_nodes.length === validation.api_nodes.filter(n=>n.audit_policy).length) {
      validation.audit_policy = true
    } else {
      validation.errors.push("audit policy missing on kube-apiserver nodes: "+validation.api_nodes.filter(n=>!n.audit_policy).map(n=>n.name).join(", "))
    }

    //determine if logging path if configured and consistent
    if(validation.api_nodes.length === validation.api_nodes.filter(n=>n.audit_log_path).length) {
      validation.audit_policy = true;
    } else {
      validation.errors.push("audit log file missing on kube-apiserver nodes: "+validation.api_nodes.filter(n=>!n.audit_policy).map(n=>n.name).join(", "))
    }

    //consistent log files?
    let audit_log_files = [...new Set(validation.api_nodes.map(n=>n.audit_log_path))];
    if(audit_log_files.length>1) {
      validation.errors.push("audit log multiple log files: "+JSON.stringify(audit_log_files));
    }

    //audit on mounted volume?
    validation.api_nodes.forEach(node => {
      let spec = kubeapiNodes.find(n=>n.metadata.name==node.name).spec;
      let container = spec.containers[0];
      node.audit_log_mounted = false;
      container.volumeMounts.forEach(volume => {
        if(node.audit_log_path.match(volume.mountPath)) node.audit_log_mounted = true;
      })
    })
    if(validation.api_nodes.length === validation.api_nodes.filter(n=>n.audit_log_mounted).length) {
      validation.audit_policy = true;
    } else {
      validation.errors.push("audit log path not mounted on kube-apiserver nodes: "+validation.api_nodes.filter(n=>!n.audit_log_mounted).map(n=>n.name).join(", "))
    }
    return {
      kubeapi_api_nodes: validation.api_nodes,
      kubeapi_errors: validation.errors
    };
  }
}

module.exports = KubeApi;