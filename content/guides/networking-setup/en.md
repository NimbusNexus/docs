---
title: Project networking setup
description: Networks, subnets, routers, and security groups — the canonical wiring for a multi-tier app.
publishedAt: 2026-05-20
updatedAt: 2026-11-04
kind: guide
---

# Project networking setup

The canonical NimbusNexus network setup for a multi-tier application: one private network per tier (public-facing and database-only), a router connecting them to each other and to the internet, and security groups restricting traffic between tiers. This guide walks the setup end-to-end and explains why each piece exists.

By the end you'll have:

- Two networks, each with one subnet (`10.0.1.0/24` for web, `10.0.2.0/24` for database)
- A router with an external gateway, attached to both subnets
- Two security groups: `web-sg` (HTTPS open to internet) and `db-sg` (port 5432 only from `web-sg`)
- A test pattern for verifying isolation works

## Why this layout {#why}

Single-VM apps don't need any of this — a VM on the external network holds a public address directly. This layout is for apps that:

- Have multiple components (web tier + database, web tier + worker tier + cache, ...)
- Need to keep parts of the stack off the public internet
- Want to enforce "the web tier can talk to the DB tier; nothing else can"

For a true single-VM application, see [Container deployment patterns](/docs/guides/container-deploy) instead.

## Prereqs {#prereqs}

- An API key that can make these calls: `unrestricted`, or access rules that name them ([What a key may do](/docs/authentication#scopes)).
- A rough idea of which VMs / services you want in which tier.

Everything you create here lands in your session's [region](/docs/api/regions).

```bash
export NIMBUS_KEY="<your-api-key>"
```

## 1 · Create the networks {#network}

A network is the L2 broadcast domain — every VM and resource attached to the same network can reach each other (subject to security groups). Create one per tier: a VM joins a network, not a subnet, so on a network with two subnets you couldn't choose which subnet it lands on.

```bash
curl -X POST {{API_BASE_URL}}/api/v1/network/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "web-network" }'

curl -X POST {{API_BASE_URL}}/api/v1/network/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "db-network" }'
```

Each answer holds the new network's `id` under `data`. Save both:

```bash
export WEB_NET_ID="<web-network-id>"
export DB_NET_ID="<db-network-id>"
```

## 2 · Create two subnets {#subnets}

Give each network an address block. Pick something that doesn't overlap with your office VPN, your home network, or any other network you might connect to later (so `192.168.0.0/16` is usually a poor choice — too commonly used). Blocks inside `10.0.0.0/16` work for most setups; `172.16.0.0/12` is fine too.

```bash
# Web subnet
curl -X POST {{API_BASE_URL}}/api/v1/subnet/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"web\",
    \"network_id\": \"$WEB_NET_ID\",
    \"ip_version\": 4,
    \"cidr\": \"10.0.1.0/24\",
    \"gateway_ip\": \"10.0.1.1\"
  }"

# Database subnet
curl -X POST {{API_BASE_URL}}/api/v1/subnet/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"db\",
    \"network_id\": \"$DB_NET_ID\",
    \"ip_version\": 4,
    \"cidr\": \"10.0.2.0/24\",
    \"gateway_ip\": \"10.0.2.1\"
  }"
```

The gateway IP is the address of the router's interface on that subnet. VMs use it as their default route.

Save both subnets' `id`s:

```bash
export WEB_SUBNET_ID="<web-subnet-id>"
export DB_SUBNET_ID="<db-subnet-id>"
```

## 3 · Create the router and attach it to both subnets {#router}

The router is what gets traffic from the subnets out to the internet (and back), and from one subnet to the other. `GET /api/v1/router/artifacts` lists the external networks it can connect to:

```bash
curl -s {{API_BASE_URL}}/api/v1/router/artifacts \
  -H "X-API-Key: $NIMBUS_KEY" | jq '.data.external_networks.data'
```

```bash
export EXTERNAL_NET_ID="<external-network-id>"

curl -X POST {{API_BASE_URL}}/api/v1/router/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"app-router\",
    \"external_gateway_info\": { \"network_id\": \"$EXTERNAL_NET_ID\" },
    \"bandwidth_subscription\": \"Monthly\",
    \"bandwidth_mbps\": 100
  }"
```

`external_gateway_info` allocates a public IP on the router and enables SNAT for outbound traffic from subnets attached to it. It also needs `bandwidth_subscription` and `bandwidth_mbps` (a multiple of 10): the gateway is capped at that bandwidth, and the bandwidth is billed ([Pricing data](/docs/api/pricing-data)).

Save the router ID and attach it to both subnets:

```bash
export ROUTER_ID="<router-id>"

curl -X PUT {{API_BASE_URL}}/api/v1/router/$ROUTER_ID/interface \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"subnet_id\": \"$WEB_SUBNET_ID\" }"

curl -X PUT {{API_BASE_URL}}/api/v1/router/$ROUTER_ID/interface \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"subnet_id\": \"$DB_SUBNET_ID\" }"
```

The web tier can now reach the database tier, and database VMs can reach the internet for things like package updates. Nothing on the internet can reach a VM that has no floating IP — that's how you keep the database tier off the public internet.

## 4 · Create the security groups {#security-groups}

Security groups are stateful firewalls applied to a VM's network interfaces. They control what traffic gets in (ingress) and what goes out (egress). "Stateful" means a connection initiated from inside is automatically allowed back — you only need rules for connections initiated from outside. A new group lets all traffic out and none in, so these two only need ingress rules.

```bash
curl -X POST {{API_BASE_URL}}/api/v1/security_group/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "web-sg", "description": "Web tier" }'

curl -X POST {{API_BASE_URL}}/api/v1/security_group/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "db-sg", "description": "Database tier" }'
```

Save both groups' `id`s, then add one rule per call:

```bash
export WEB_SG_ID="<web-sg-id>"
export DB_SG_ID="<db-sg-id>"

# Web security group — HTTPS open to the internet
curl -X POST {{API_BASE_URL}}/api/v1/security_group/rule \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"security_group_id\": \"$WEB_SG_ID\",
    \"direction\": \"ingress\",
    \"ether\": \"IPv4\",
    \"protocol\": \"tcp\",
    \"port_min\": 443,
    \"remote_cidr\": \"0.0.0.0/0\",
    \"description\": \"HTTPS\"
  }"

# Web security group — SSH from your office
curl -X POST {{API_BASE_URL}}/api/v1/security_group/rule \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"security_group_id\": \"$WEB_SG_ID\",
    \"direction\": \"ingress\",
    \"ether\": \"IPv4\",
    \"protocol\": \"tcp\",
    \"port_min\": 22,
    \"remote_cidr\": \"203.0.113.5/32\",
    \"description\": \"SSH from office\"
  }"

# DB security group — port 5432 only from the web SG
curl -X POST {{API_BASE_URL}}/api/v1/security_group/rule \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"security_group_id\": \"$DB_SG_ID\",
    \"direction\": \"ingress\",
    \"ether\": \"IPv4\",
    \"protocol\": \"tcp\",
    \"port_min\": 5432,
    \"remote_sec_grp\": \"$WEB_SG_ID\",
    \"description\": \"Postgres from web tier\"
  }"
```

The `remote_sec_grp` in the DB SG's rule is what enforces "only the web tier can connect" — instead of a static CIDR, the rule references the SG itself. Any VM in `web-sg` can reach the DB. Add or remove VMs from `web-sg` and the access list updates automatically.

The web SG opens port 22 (SSH) from a specific office IP, not the world. Don't open SSH to `0.0.0.0/0` — every cloud has scanners checking 22 for weak passwords.

## 5 · Attach VMs {#attach}

When creating a VM, specify the network and security groups. [Quickstart](/docs/quickstart#region) shows where the image and the `spec` values come from. `sshs` names an [SSH key](/docs/api/ssh-keys) you've registered.

```bash
export SSH_KEY_NAME="<ssh-key-name>"

# Web tier VM
curl -X POST {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"web-01\",
    \"image\": \"$IMAGE_ID\",
    \"spec\": {
      \"architecture\": \"$ARCHITECTURE\",
      \"vm_class\": \"$VM_CLASS\",
      \"cpu\": 2,
      \"ram\": 4096,
      \"volume_type\": \"$VOLUME_TYPE\"
    },
    \"volume_size\": 25,
    \"network\": [\"$WEB_NET_ID\"],
    \"security_group\": [\"$WEB_SG_ID\"],
    \"sshs\": \"$SSH_KEY_NAME\"
  }"

# Database tier VM (if running DB on your own VM)
curl -X POST {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"db-01\",
    \"image\": \"$IMAGE_ID\",
    \"spec\": {
      \"architecture\": \"$ARCHITECTURE\",
      \"vm_class\": \"$VM_CLASS\",
      \"cpu\": 4,
      \"ram\": 8192,
      \"volume_type\": \"$VOLUME_TYPE\"
    },
    \"volume_size\": 50,
    \"network\": [\"$DB_NET_ID\"],
    \"security_group\": [\"$DB_SG_ID\"],
    \"sshs\": \"$SSH_KEY_NAME\"
  }"
```

For external access to the web VM, allocate a [floating IP](/docs/api/floating-ips) and attach it. The DB VM never gets a floating IP — that's how the network isolation works.

## 6 · Verify isolation {#verify}

Test that the design actually enforces what you wanted. Find the DB VM's address in `nics` from `GET /api/v1/instance/`; we'll say it's `10.0.2.10`.

```bash
# From the web VM, can we reach the DB on 5432? (Should: yes)
nc -v -w 3 10.0.2.10 5432

# From the web VM, can we reach the DB on 22 (SSH)? (Should: no — DB SG only opens 5432)
nc -v -w 3 10.0.2.10 22

# From your laptop, can we reach the DB directly? (Should: no — the DB VM has no public IP)
nc -v -w 3 10.0.2.10 5432
```

If any of these don't behave as expected, the security group rules or the network/subnet attachments are off. Re-check.

## What this isn't {#not}

- **Not VPC peering.** This is one project's internal network. Two NimbusNexus projects' networks don't peer — by design (see [Security model](/docs/security#network)).
- **Not a complete WAF or DDoS layer.** Security groups are L3/L4 — they can't inspect HTTP request bodies. For application-layer filtering, run a WAF (e.g. ModSecurity behind nginx) in the web tier.
- **Not autoscaling.** You're managing the VMs manually. For autoscaled fleets, the same network primitives work, but you'd want infrastructure-as-code (Terraform, Pulumi) to manage them at scale.

## Next steps {#next-steps}

- [Networks reference](/docs/api/networks) — every option for the create call.
- [Subnets reference](/docs/api/subnets) — IPv6 setup, DHCP options, DNS nameserver overrides.
- [Security groups reference](/docs/api/security-groups) — the full rule syntax.
- [Routers reference](/docs/api/routers) — static routes and how NAT works.
- [Floating IPs](/docs/api/floating-ips) — the public-IP primitive that ties this to the outside world.
