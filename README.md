# kubeapi auditlog to cloudwatch shipper

## Step 1 - updated kubeapi server
Update a file such as `/etc/kubernetes/manifests/kube-apiserver.yaml` with the following arguments:
```
    - --audit-policy-file=/etc/kubernetes/audit-policy/audit-policy.yaml
    - --audit-log-path=/var/log/kubernetes/audit.log
    - --audit-log-maxage=3
    - --audit-log-maxbackup=50
    - --audit-log-maxsize=10
```

You will also need to mount the `/var/log/kubernetes` volume

under `.spec.containers[0].volumeMounts` add:
```
    - mountPath: /var/log/kubernetes
      name: var-log-kubernetes
    - mountPath: /etc/kubernetes/audit-policy
      name: etc-kubernetes-audit-policy
      readOnly: true
```

under `.spec.volumes` add:
```
  - hostPath:
      path: /etc/kubernetes/audit-policy
      type: DirectoryOrCreate
    name: etc-kubernetes-audit-policy
  - hostPath:
      path: /var/log/kubernetes
      type: DirectoryOrCreate
```

## Step 2 - add a policy file
Add a file `/etc/kubernetes/audit-policy/audit-policy.yaml` unless one exists.  Sample file:
```
apiVersion: audit.k8s.io/v1 # This is required.
kind: Policy
# Don't generate audit events for all requests in RequestReceived stage.
omitStages:
  - "RequestReceived"
rules:
  # Log pod changes at RequestResponse level
  - level: RequestResponse
    resources:
    - group: ""
      # Resource "pods" doesn't match requests to any subresource of pods,
      # which is consistent with the RBAC policy.
      resources: ["pods"]
  # Log "pods/log", "pods/status" at Metadata level
  - level: Metadata
    resources:
    - group: ""
      resources: ["pods/log", "pods/status"]

  # Don't log requests to a configmap called "controller-leader"
  - level: None
    resources:
    - group: ""
      resources: ["configmaps"]
      resourceNames: ["controller-leader"]

  # Don't log watch requests by the "system:kube-proxy" on endpoints or services
  - level: None
    users: ["system:kube-proxy"]
    verbs: ["watch"]
    resources:
    - group: "" # core API group
      resources: ["endpoints", "services"]

  # Don't log authenticated requests to certain non-resource URL paths.
  - level: None
    userGroups: ["system:authenticated"]
    nonResourceURLs:
    - "/api*" # Wildcard matching.
    - "/version"

  # Log the request body of configmap changes in kube-system.
  - level: Request
    resources:
    - group: "" # core API group
      resources: ["configmaps"]
    # This rule only applies to resources in the "kube-system" namespace.
    # The empty string "" can be used to select non-namespaced resources.
    namespaces: ["kube-system"]

  # Log configmap and secret changes in all other namespaces at the Metadata level.
  - level: Metadata
    resources:
    - group: "" # core API group
      resources: ["secrets", "configmaps"]

  # Log all other resources in core and extensions at the Request level.
  - level: Request
    resources:
    - group: "" # core API group
    - group: "extensions" # Version of group should NOT be included.

  # A catch-all rule to log all other requests at the Metadata level.
  - level: Metadata
    # Long-running requests like watches that fall under this rule will not
    # generate an audit event in RequestReceived.
    omitStages:
      - "RequestReceived"
```

## Step 3 - update create a values.yaml
To deploy with helm, create a `values.yaml` file:
```
AWS:
  AWS_ACCESS_KEY_ID: <base64 encoded>
  AWS_REGION: us-west-2
  AWS_SECRET_ACCESS_KEY: <base64 encoded>
cloudwatch:
  loggroup: /aws/eks/<clustername>/cluster
k8s:
  audit_log_path: /var/log/kubernetes
```

And then run
```
helm upgrade --namespace lacework --create-namespace \
   kubeaudit-cloudwatch ./helm-chart -f values.yaml
```