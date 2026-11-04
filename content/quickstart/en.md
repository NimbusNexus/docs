---
title: Quickstart
description: Generate an API key, read your options, and create your first VM.
publishedAt: 2026-05-19
updatedAt: 2026-11-04
kind: quickstart
---

# Quickstart

This guide takes you from a signed-in dashboard account to a running virtual machine in a few API calls. Everything you do here is reversible: delete the VM when you're done. A VM is billed from create until delete, so don't leave it running by accident; [Pricing data](/docs/api/pricing-data) has the prices.

## Before you start {#prereqs}

You need three things:

- A NimbusNexus account. Sign up at [{{ROOT_DOMAIN}}]({{BASE_URL}}/register).
- The `curl` command-line tool, or any HTTP client of your choice, and `jq` to read the answers. Examples on this page use `curl`; the same calls work in any language.
- About five minutes.

You don't need SSH set up yet: this VM boots without a key. To log in to a VM later, register a key first ([SSH keys](/docs/api/ssh-keys)) and name it in `sshs` when you create the VM.

## 1 · Generate an API key {#api-key}

Sign in to the dashboard and go to **Security → API tokens → Create token**. Give the token a name you'll recognize later (e.g. `quickstart`) and choose the **Admin** scope, which makes an unrestricted key. The other two scopes make a key with no access rules, and that key can only read its own session. Copy the value labelled **API key**, not **Secret**, somewhere safe — you only see it once.

Export it as an environment variable so the examples below can reference it:

```bash
export NIMBUS_KEY="<your-api-key>"
```

Send it in the `X-API-Key` header on every call. API keys are scoped to a single project. The default project that gets created with your account is fine for now. [Authentication](/docs/authentication#scopes) covers keys limited to the calls they need.

## 2 · Read your options {#region}

NimbusNexus serves one region today, in Frankfurt, Germany, so there's no region to pick; [Regions](/docs/api/regions) has the details. Ask the API what you can create there:

```bash
curl -s {{API_BASE_URL}}/api/v1/instance/artifacts \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data | {
      images: [.images.data[] | { id, name }],
      vm_options: [.vm_options.data[] | { architecture: .label, vm_classes: [.children[]?.label] }],
      networks: [.networks.data[] | { id, name, external, subnets: [.subnets[].cidr] }],
      security_groups: [.security_groups.data[] | { id, name }]
    }'
```

The boot disk's volume type comes from a second call:

```bash
curl -s {{API_BASE_URL}}/api/v1/storage/artifacts \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '[.data.volume_options.data[].label]'
```

Pick one of each and export them. Images, networks and security groups go by `id`; architectures, VM classes and volume types go by label. Pick a network with `external: false` that has a subnet: joining an external network also needs `bandwidth_mbps` and `subscription.bandwidth`, and without them the call answers `400`.

```bash
export IMAGE_ID="<image-id>"
export ARCHITECTURE="<architecture>"
export VM_CLASS="<vm-class>"
export VOLUME_TYPE="<volume-type>"
export NETWORK_ID="<network-id>"
export SECURITY_GROUP_ID="<security-group-id>"
```

## 3 · Create your first VM {#first-vm}

A VM's shape is its `cpu` count and its `ram` in MB. Its boot disk is `volume_size` GB. Boot one with one vCPU, 2 GB RAM and a 25 GB disk:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"quickstart\",
    \"image\": \"$IMAGE_ID\",
    \"spec\": {
      \"architecture\": \"$ARCHITECTURE\",
      \"vm_class\": \"$VM_CLASS\",
      \"cpu\": 1,
      \"ram\": 2048,
      \"volume_type\": \"$VOLUME_TYPE\"
    },
    \"volume_size\": 25,
    \"network\": [\"$NETWORK_ID\"],
    \"security_group\": [\"$SECURITY_GROUP_ID\"]
  }"
```

A shape that isn't on offer for that architecture and class answers `400`; [Pricing data](/docs/api/pricing-data) lists them. Otherwise the call queues the work and answers with no id:

```json
{
  "success": true
}
```

Find the new VM by name and read its `status`:

```bash
curl -s {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | select(.name == "quickstart") | { id, status, nics, fault }'
```

`status` is `BUILD` at first, then `ACTIVE`, with the VM's addresses in `nics`:

```json
{
  "id": "3f0c9e1a-6b7d-4c2e-9a51-7d2b8f4e1c60",
  "status": "ACTIVE",
  "nics": {
    "my-network": [
      { "addr": "10.0.0.12", "version": 4, "OS-EXT-IPS:type": "fixed" }
    ]
  },
  "fault": null
}
```

Poll once in a while until `status` is `ACTIVE`. If it's `ERROR`, `fault` says what went wrong. Save the id:

```bash
export VM_ID="<vm-id>"
```

## What you've done {#summary}

You've created an API key, read your options, and provisioned a real virtual machine. Many resources work the same way: an `artifacts` call lists your options, `POST` creates, and `GET` reads. Deleting varies by resource, so check its reference page. The API key and the header are the same everywhere on `{{API_HOST}}`.

## Next steps {#next-steps}

- Browse the **API reference** to see every endpoint with parameters, request/response schemas, and error codes.
- Attach a [floating IP](/docs/api/floating-ips) to reach the VM from the internet.
- Read about **authentication** to understand how API keys work alongside project scoping, roles, and access rules.
- Read **conventions** to learn the patterns the API follows — pagination, error shapes, work that finishes after the answer.
- Try the **interactive API explorer** at [{{API_HOST}}/docs/external]({{API_BASE_URL}}/docs/external) — it's a Swagger UI wired up to the live API; "Try it out" makes real calls against your account.

When you're done, delete the VM so you stop being billed. Its boot volume goes with it:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/action \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"servers\": [\"$VM_ID\"], \"cmd\": \"delete\" }"
```
