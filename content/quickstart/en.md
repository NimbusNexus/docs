---
title: Quickstart
description: Generate an API key, pick a region, and create your first VM in three requests.
publishedAt: 2026-05-19
updatedAt: 2026-05-19
kind: quickstart
---

# Quickstart

This guide takes you from a signed-in dashboard account to a running virtual machine in three API calls. Everything you do here is reversible — destroy the VM when you're done and you'll have spent a few cents at most.

## Before you start {#prereqs}

You need three things:

- A NimbusNexus account. Sign up at [{{ROOT_DOMAIN}}]({{BASE_URL}}/register) — you'll get a starter credit that covers this quickstart and then some.
- The `curl` command-line tool, or any HTTP client of your choice. Examples on this page use `curl`; the same calls work in any language.
- About five minutes.

You don't need SSH set up yet. We'll create a key as part of the second call.

## 1 · Generate an API key {#api-key}

Sign in to the dashboard and go to **Settings → API keys → New key**. Give the key a label you'll recognize later (e.g. `quickstart`) and copy the value somewhere safe — you only see it once.

Export it as an environment variable so the examples below can reference it:

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
```

API keys are scoped to a single project. The default project that gets created with your account is fine for now; you can split workloads across projects later without rotating keys.

## 2 · Pick a region {#region}

NimbusNexus runs in four regions:

| Region          | Code             | Status     |
| --------------- | ---------------- | ---------- |
| Virginia, US    | `us-east-1`      | Live       |
| Los Angeles, US | `us-west-1`      | Live       |
| Frankfurt, DE   | `eu-central-1`   | Live       |
| Singapore       | `ap-southeast-1` | Pre-launch |

Pick the one closest to where your users (or your existing infrastructure) live. Latency between regions inside NimbusNexus is free; egress to the public internet is the only billable transfer.

You can ask the API for the canonical list at any time:

```bash
curl {{API_BASE_URL}}/v1/regions \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

## 3 · Create your first VM {#first-vm}

The smallest VM that's useful for real work is a `gp-1-2` — one vCPU, 2 GB RAM, 25 GB SSD. It costs about a penny an hour. Boot one in Virginia with:

```bash
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "quickstart",
    "size": "gp-1-2",
    "region": "us-east-1",
    "image": "ubuntu-24.04"
  }'
```

The response includes the VM's id and current state. State will be `provisioning` for the first few seconds, then `running`:

```json
{
  "id": "vm_01H...",
  "name": "quickstart",
  "size": "gp-1-2",
  "region": "us-east-1",
  "image": "ubuntu-24.04",
  "state": "provisioning",
  "ipv4": null,
  "created_at": "2026-05-19T18:30:00Z"
}
```

Poll the VM once a second until `state` is `running` and `ipv4` is populated — that takes about 28 seconds on a cached image, or 60–90 seconds on a first-time pull.

## What you've done {#summary}

You've created an API key, picked a region, and provisioned a real virtual machine. The same three-call pattern works for every resource in the API: `POST` to create, `GET` to read, `DELETE` to destroy. Authentication, region codes, and resource ids are stable across resource types — the API was designed so you can learn it once and apply it to anything.

## Next steps {#next-steps}

- Browse the **API reference** to see every endpoint with parameters, request/response schemas, and error codes.
- Read about **authentication** to understand how API keys work alongside project scoping, expiring tokens, and webhook signing.
- Read **conventions** to learn the patterns the API follows everywhere — idempotency, pagination, error shapes, long-running operations.
- Try the **interactive API explorer** at [{{API_HOST}}/docs/external]({{API_BASE_URL}}/docs/external) — it's a Swagger UI wired up to the live API; "Try it out" makes real calls against your account.

When you're done, destroy the VM so you stop being billed:

```bash
curl -X DELETE {{API_BASE_URL}}/v1/vms/vm_01H... \
  -H "Authorization: Bearer $NIMBUS_KEY"
```
