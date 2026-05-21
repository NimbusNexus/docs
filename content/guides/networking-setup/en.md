---
title: Project networking setup
description: Networks, subnets, routers, and security groups — the canonical wiring for a multi-tier app.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

# Project networking setup

The canonical NimbusNexus network setup for a multi-tier application: a private network with two subnets (public-facing and database-only), a router connecting the public subnet to the internet, and security groups restricting traffic between tiers. This guide walks the setup end-to-end and explains why each piece exists.

By the end you'll have:

- A network with two subnets (`10.0.1.0/24` for web, `10.0.2.0/24` for database)
- A router with an external gateway, attached to the web subnet
- Two security groups: `web-sg` (HTTPS open to internet) and `db-sg` (port 5432 only from `web-sg`)
- A test pattern for verifying isolation works

## Why this layout {#why}

Single-VM apps don't need any of this — a VM with a floating IP and no network configuration works fine. This layout is for apps that:

- Have multiple components (web tier + database, web tier + worker tier + cache, ...)
- Need to keep parts of the stack off the public internet
- Want to enforce "the web tier can talk to the DB tier; nothing else can"

For a true single-VM application, see [Container deployment patterns](/docs/guides/container-deploy) instead.

## Prereqs {#prereqs}

- API key with `networks:write` and `vms:write` scopes.
- A region picked (we'll use `us-east-1`).
- A rough idea of which VMs / services you want in which tier.

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export REGION="us-east-1"
```

## 1 · Create the network {#network}

A network is the L2 broadcast domain — every VM and resource attached to the same network can route to each other (subject to security groups).

```bash
curl -X POST {{API_BASE_URL}}/v1/networks \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "app-network",
    "region": "us-east-1",
    "cidr": "10.0.0.0/16"
  }'
```

The `10.0.0.0/16` block is the address space for everything inside this network. Pick something that doesn't overlap with your office VPN, your home network, or any other network you might peer with later (so `192.168.0.0/16` is usually a poor choice — too commonly used). `10.0.0.0/16` works for most setups; `172.16.0.0/12` is fine too.

Save the network ID:

```bash
export NET_ID="net_01HG7Y3..."
```

## 2 · Create two subnets {#subnets}

Carve the network into two subnets — one for things that face the public internet, one for things that shouldn't.

```bash
# Web subnet — VMs that need internet access
curl -X POST {{API_BASE_URL}}/v1/subnets \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"web\",
    \"network_id\": \"$NET_ID\",
    \"cidr\": \"10.0.1.0/24\",
    \"gateway_ip\": \"10.0.1.1\"
  }"

# Database subnet — for tier-2 resources
curl -X POST {{API_BASE_URL}}/v1/subnets \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"db\",
    \"network_id\": \"$NET_ID\",
    \"cidr\": \"10.0.2.0/24\",
    \"gateway_ip\": \"10.0.2.1\"
  }"
```

The gateway IP is the address of the router's interface on that subnet. VMs use it as their default route.

## 3 · Create the router and attach it to the web subnet {#router}

The router is what gets traffic from the web subnet out to the internet (and back). The database subnet doesn't get a router connection — that's how you keep it off the public internet.

```bash
curl -X POST {{API_BASE_URL}}/v1/routers \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"app-router\",
    \"region\": \"us-east-1\",
    \"external_gateway\": true
  }"
```

`external_gateway: true` allocates a public IP on the router and enables SNAT for outbound traffic from subnets attached to it.

Save the router ID and attach it to the web subnet:

```bash
export ROUTER_ID="rtr_01HG7Y3..."

curl -X POST {{API_BASE_URL}}/v1/routers/$ROUTER_ID/interfaces \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"subnet_id\": \"$WEB_SUBNET_ID\" }"
```

The DB subnet stays off the router. Anything in the DB subnet can only reach what's reachable via the L2 network — which means other things in the same network, controlled by security groups.

## 4 · Create the security groups {#security-groups}

Security groups are stateful firewalls applied to a VM's network interfaces. They control what traffic gets in (ingress) and what goes out (egress). "Stateful" means a connection initiated from inside is automatically allowed back — you only need rules for connections initiated from outside.

```bash
# Web security group — HTTPS open to the internet
curl -X POST {{API_BASE_URL}}/v1/security-groups \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "web-sg",
    "region": "us-east-1",
    "ingress_rules": [
      { "protocol": "tcp", "port": 443, "source_cidr": "0.0.0.0/0", "description": "HTTPS" },
      { "protocol": "tcp", "port": 22, "source_cidr": "203.0.113.5/32", "description": "SSH from office" }
    ],
    "egress_rules": [
      { "protocol": "any", "destination_cidr": "0.0.0.0/0", "description": "anywhere" }
    ]
  }'

# DB security group — port 5432 only from the web SG
curl -X POST {{API_BASE_URL}}/v1/security-groups \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "db-sg",
    "region": "us-east-1",
    "ingress_rules": [
      { "protocol": "tcp", "port": 5432, "source_security_group": "web-sg", "description": "Postgres from web tier" }
    ],
    "egress_rules": [
      { "protocol": "any", "destination_cidr": "0.0.0.0/0", "description": "anywhere" }
    ]
  }'
```

The `source_security_group` in the DB SG's rule is what enforces "only the web tier can connect" — instead of a static CIDR, the rule references the SG itself. Any VM tagged with `web-sg` can reach the DB. Add or remove VMs from `web-sg` and the access list updates automatically.

The web SG opens port 22 (SSH) from a specific office IP, not the world. Don't open SSH to `0.0.0.0/0` — every cloud has scanners checking 22 for weak passwords.

## 5 · Attach VMs {#attach}

When creating a VM, specify the network, subnet, and security groups:

```bash
# Web tier VM
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"web-01\",
    \"size\": \"gp-2-4\",
    \"region\": \"us-east-1\",
    \"image\": \"ubuntu-24.04\",
    \"network_interfaces\": [
      { \"subnet_id\": \"$WEB_SUBNET_ID\", \"security_groups\": [\"web-sg\"] }
    ]
  }"

# Database tier VM (if running DB on your own VM rather than managed DB)
curl -X POST {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"db-01\",
    \"size\": \"gp-4-8\",
    \"region\": \"us-east-1\",
    \"image\": \"ubuntu-24.04\",
    \"network_interfaces\": [
      { \"subnet_id\": \"$DB_SUBNET_ID\", \"security_groups\": [\"db-sg\"] }
    ]
  }"
```

For external access to the web VM, allocate a [floating IP](/docs/api/floating-ips) and attach it. The DB VM never gets a floating IP — that's how the network isolation works.

## 6 · Verify isolation {#verify}

Test that the design actually enforces what you wanted:

```bash
# From the web VM, can we reach the DB on 5432? (Should: yes)
nc -v -w 3 10.0.2.10 5432

# From the web VM, can we reach the DB on 22 (SSH)? (Should: no — DB SG only opens 5432)
nc -v -w 3 10.0.2.10 22

# From your laptop, can we reach the DB directly? (Should: no — DB subnet isn't routable from internet)
nc -v -w 3 <DB_PUBLIC_IP> 5432  # there's no public IP, this fails
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
- [Routers reference](/docs/api/routers) — static routes, BGP advertisement, more advanced wiring.
- [Floating IPs](/docs/api/floating-ips) — the public-IP primitive that ties this to the outside world.
