---
title: Blue/green deploys with floating IPs
description: Zero-downtime deploys by swinging a floating IP between two warm VMs.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Blue/green deploys with floating IPs

The classic blue/green pattern: run the current production behind a floating IP, build the new version on a separate VM, run smoke tests against it while it's still off the public path, then swing the floating IP from the old VM to the new one. Traffic shifts in ~2 seconds. If something goes wrong, swing the IP back.

This guide assumes a single-VM workload (one production VM, one staging VM). For multi-VM workloads behind a load balancer, see [Load balancers](/docs/api/load-balancers) — the same pattern applies but you swap LB target pools instead.

## Prereqs {#prereqs}

- Two VMs in the same region. We'll call them `blue` (currently serving) and `green` (next version).
- A [floating IP](/docs/api/floating-ips) currently attached to `blue`.
- A DNS A record pointing at the floating IP.
- `nimbus` CLI installed, or curl with $NIMBUS_KEY set.

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export BLUE_ID="vm_01HG7Y3..."     # currently serving
export GREEN_ID="vm_01HG7Y4..."    # new version
export FLOATING_IP_ID="ip_01HG7..."
```

## 1 · Build the green VM {#build-green}

Bring up the new version with the updated code/config but without the floating IP attached. It's a standalone VM with a default public IP at this stage; nothing in production hits it.

Deploy your application to it, run database migrations (if they're forward-compatible — see "schema migrations" below), warm caches, run any startup work that should happen before traffic arrives.

## 2 · Smoke-test green {#smoke}

Hit green's default public IP directly:

```bash
GREEN_IP=$(curl -s {{API_BASE_URL}}/v1/vms/$GREEN_ID \
  -H "Authorization: Bearer $NIMBUS_KEY" | jq -r '.ipv4')

curl -H "Host: app.example.com" "http://$GREEN_IP/healthz"
curl -H "Host: app.example.com" "http://$GREEN_IP/api/critical-endpoint"
```

The `Host` header lets you test behaviors that depend on the canonical hostname (e.g. routing, CORS, anything cert-pinned) without changing DNS. If your service requires HTTPS and you've pinned a cert to `app.example.com`, set up the cert on green ahead of time (Let's Encrypt with HTTP-01 challenge against green's default IP works).

Run any other tests you'd run before promoting:

- Full smoke-test suite
- Database connectivity check (especially if green is behind a different connection-pooler config)
- Webhook signature verification (if you've rotated the secret)

## 3 · Swing the floating IP {#swing}

This is the cutover. One API call:

```bash
curl -X POST {{API_BASE_URL}}/v1/floating-ips/$FLOATING_IP_ID/attach \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"vm_id\": \"$GREEN_ID\" }"
```

What happens:

- The floating IP detaches from `blue` (it kept the IP as one of its public addresses)
- The floating IP attaches to `green`
- Network propagation takes ~2 seconds; the IP starts serving from green
- TCP connections to the old VM's IP stay open until they idle out (typically 30–60 seconds for HTTP keepalive); new connections hit green

For most HTTP workloads, this is effectively zero-downtime. Existing connections finish their requests on blue; new requests land on green. Users on long-lived connections (SSE, WebSocket) get reconnected automatically by their clients.

## 4 · Watch green under traffic {#watch}

Tail logs on green, watch error rates, watch the dashboard's request graph. Real-traffic anomalies show up here that smoke tests didn't catch.

The window where you can cheaply roll back is the first ~5 minutes. Beyond that, blue is "running old code with no traffic" and you're paying for it; you'll want to either:

- Promote green and stop blue (the happy path)
- Stop both and start over (rare)

## 5 · Stop blue {#stop-blue}

If everything's green (literally), stop blue to stop paying for it:

```bash
curl -X POST {{API_BASE_URL}}/v1/vms/$BLUE_ID/stop \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

Don't `delete` it immediately. Stopped VMs cost ~10 % of running VMs (storage only) and let you `start` them again as a fast rollback for ~24 hours. After 24 hours, delete them.

## Rollback path {#rollback}

If green misbehaves under traffic, the rollback is symmetric:

```bash
curl -X POST {{API_BASE_URL}}/v1/floating-ips/$FLOATING_IP_ID/attach \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"vm_id\": \"$BLUE_ID\" }"
```

Same ~2 seconds, traffic back on blue. Rollbacks become harder if your database migrations weren't forward-compatible — keep schema migrations decoupled from code rollouts and you keep the rollback option open.

## Schema migrations {#migrations}

The pattern that makes blue/green work cleanly with schema changes: **decouple migration from deploy**.

Each schema change is two PRs, one week apart:

1. **Migration PR.** Schema migration that's backward-compatible. New tables, new nullable columns, new indexes. Old code still works against the new schema. Deploy this through normal channels (no blue/green required — backward compat means the migration is safe to land independently).
2. **Code PR.** Code that uses the new schema. Deploy this via blue/green.

When you need to drop a column or change a type, the sequence is the reverse: code stops using the column → deploy code → migration drops the column. Always two PRs separated in time. Always pause-time-safe in between.

This pattern is more work than "always deploy schema + code together" but it preserves rollback safety, which is what blue/green is for in the first place.

## Next steps {#next-steps}

- [Floating IPs reference](/docs/api/floating-ips) — every endpoint on the resource that makes this pattern possible.
- [Load balancers](/docs/api/load-balancers) — the multi-VM version of the same pattern.
- [Multi-region failover](/docs/guides/multi-region) — same idea, applied across geographically distant pairs.
