---
title: Blue/green deploys with floating IPs
description: Zero-downtime deploys by swinging a floating IP between two warm VMs.
publishedAt: 2026-05-20
updatedAt: 2026-11-04
kind: guide
---

# Blue/green deploys with floating IPs

The classic blue/green pattern: run the current production behind a floating IP, build the new version on a separate VM, run smoke tests against it while it's still off the public path, then swing the floating IP from the old VM to the new one. Traffic shifts as soon as the IP attaches. If something goes wrong, swing the IP back.

This guide assumes a single-VM workload (one production VM, one staging VM). For multi-VM workloads behind a load balancer, see [Load balancers](/docs/api/load-balancers) — the same pattern applies but you swap LB target pools instead.

## Prereqs {#prereqs}

- Two VMs in the same region. We'll call them `blue` (currently serving) and `green` (next version).
- A [floating IP](/docs/api/floating-ips) currently attached to `blue`.
- A DNS A record pointing at the floating IP.
- `curl` and `jq`, with `$NIMBUS_KEY` set to an [API key](/docs/authentication) that can make these calls.

```bash
export NIMBUS_KEY="<your-api-key>"
export BLUE_ID="<blue-vm-id>"     # currently serving
export GREEN_ID="<green-vm-id>"    # new version
export FLOATING_IP_ID="<floating-ip-id>"
```

`GET /api/v1/instance/` lists your VMs and `GET /api/v1/floating_ip/` your floating IPs, with their ids.

## 1 · Build the green VM {#build-green}

Bring up the new version with the updated code/config but without the floating IP attached. It's a standalone VM with its own address at this stage; nothing in production hits it.

Deploy your application to it, run database migrations (if they're forward-compatible — see "schema migrations" below), warm caches, run any startup work that should happen before traffic arrives.

## 2 · Smoke-test green {#smoke}

Hit green's own address directly, from somewhere that can reach it: another VM on the same network, or anywhere if green is on the external network. `GET /api/v1/instance/{server_id}/interfaces/` lists a VM's interfaces, one per network; `.data[0]` below is the first.

```bash
GREEN_IP=$(curl -s {{API_BASE_URL}}/api/v1/instance/$GREEN_ID/interfaces/ \
  -H "X-API-Key: $NIMBUS_KEY" | jq -r '.data[0].fixed_ips[0].ip_address')

curl -H "Host: app.example.com" "http://$GREEN_IP/healthz"
curl -H "Host: app.example.com" "http://$GREEN_IP/api/critical-endpoint"
```

The `Host` header lets you test behaviors that depend on the canonical hostname (e.g. routing, CORS, anything cert-pinned) without changing DNS. If your service requires HTTPS and you've pinned a cert to `app.example.com`, set up the cert on green ahead of time.

Run any other tests you'd run before promoting:

- Full smoke-test suite
- Database connectivity check (especially if green is behind a different connection-pooler config)
- Webhook signature verification (if you've rotated the secret)

## 3 · Swing the floating IP {#swing}

This is the cutover: two API calls, one to detach and one to attach. Read what the attach call needs first, green's port and the external network the IP belongs to:

```bash
GREEN_PORT_ID=$(curl -s {{API_BASE_URL}}/api/v1/instance/$GREEN_ID/interfaces/ \
  -H "X-API-Key: $NIMBUS_KEY" | jq -r '.data[0].port_id')

FLOATING_NETWORK_ID=$(curl -s {{API_BASE_URL}}/api/v1/floating_ip/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq -r ".data[] | select(.id == \"$FLOATING_IP_ID\") | .network")
```

Then swing it:

```bash
# Detach the IP from blue
curl -X POST {{API_BASE_URL}}/api/v1/floating_ip/deallocate \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"id\": \"$FLOATING_IP_ID\" }"

# Attach it to green
curl -X POST {{API_BASE_URL}}/api/v1/floating_ip/allocate \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"floating_ip_id\": \"$FLOATING_IP_ID\",
    \"floating_network_id\": \"$FLOATING_NETWORK_ID\",
    \"vm_port_id\": \"$GREEN_PORT_ID\",
    \"vm_ip_address\": \"$GREEN_IP\"
  }"
```

What happens:

- The floating IP detaches from `blue`. Between the two calls, the address has no VM behind it, so run them back to back.
- The floating IP attaches to `green`, and the IP starts serving from green.
- New connections hit green. A client with a connection open through the floating IP may have to reconnect.

For most HTTP workloads, this is effectively zero-downtime. Users on long-lived connections (SSE, WebSocket) get reconnected automatically by their clients.

## 4 · Watch green under traffic {#watch}

Tail logs on green, watch error rates, watch the dashboard's request graph. Real-traffic anomalies show up here that smoke tests didn't catch.

The window where you can cheaply roll back is the first ~5 minutes. Beyond that, blue is "running old code with no traffic" and you're paying for it; you'll want to either:

- Promote green and stop blue (the happy path)
- Stop both and start over (rare)

## 5 · Stop blue {#stop-blue}

If everything's green (literally), stop blue:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/action \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"servers\": [\"$BLUE_ID\"], \"cmd\": \"stop\" }"
```

Don't delete it immediately: a stopped VM can `start` again as a fast rollback. It's still billed, though, because a VM is billed from create until delete. Once you no longer need the rollback, delete it with `"cmd": "delete"`.

## Rollback path {#rollback}

If green misbehaves under traffic, the rollback is symmetric. Start blue again if you stopped it (`"cmd": "start"`), then swing the IP back:

```bash
BLUE_PORT_ID=$(curl -s {{API_BASE_URL}}/api/v1/instance/$BLUE_ID/interfaces/ \
  -H "X-API-Key: $NIMBUS_KEY" | jq -r '.data[0].port_id')

BLUE_IP=$(curl -s {{API_BASE_URL}}/api/v1/instance/$BLUE_ID/interfaces/ \
  -H "X-API-Key: $NIMBUS_KEY" | jq -r '.data[0].fixed_ips[0].ip_address')

curl -X POST {{API_BASE_URL}}/api/v1/floating_ip/deallocate \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"id\": \"$FLOATING_IP_ID\" }"

curl -X POST {{API_BASE_URL}}/api/v1/floating_ip/allocate \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"floating_ip_id\": \"$FLOATING_IP_ID\",
    \"floating_network_id\": \"$FLOATING_NETWORK_ID\",
    \"vm_port_id\": \"$BLUE_PORT_ID\",
    \"vm_ip_address\": \"$BLUE_IP\"
  }"
```

Same two calls, traffic back on blue. Rollbacks become harder if your database migrations weren't forward-compatible — keep schema migrations decoupled from code rollouts and you keep the rollback option open.

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
