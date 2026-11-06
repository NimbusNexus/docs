---
title: Optimizing your monthly bill
description: Where an infrastructure bill goes, and how to find the resources you can stop paying for.
publishedAt: 2026-05-20
updatedAt: 2026-11-06
kind: guide
---

# Optimizing your monthly bill

What you pay for on NimbusNexus is mostly what you've allocated, whether or not you're using it: VMs, volumes, floating IPs, public ports and their bandwidth, and custom images. So when a bill is bigger than you expected, look first for what's still allocated and no longer needed. This guide goes through those places, with the calls that find each one.

[Pricing data](/docs/api/pricing-data) has the prices. Billing is per workspace, while an API key works in one project, so repeat these calls for each project in the workspace.

## Prereqs {#prereqs}

- `curl` and `jq`, with `$NIMBUS_KEY` set to an [API key](/docs/authentication) that can make these calls.

```bash
export NIMBUS_KEY="<your-api-key>"
```

The calls below that delete or change something use the ids the lists print, as `$VM_ID`, `$FLOATING_IP_ID`, `$VOLUME_ID` and `$PORT_ID`.

## 1 · Stopped VMs you forgot about {#stopped-vms}

Stopping a VM doesn't stop its billing: a VM is billed from create until delete ([Virtual machines](/docs/api/vms#lifecycle)). Find the stopped ones:

```bash
curl -s {{API_BASE_URL}}/api/v1/instance/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | select(.status == "SHUTOFF") | { id, name, vcores, memory }'
```

A stopped VM is a fair rollback candidate for a little while, as in a [blue/green deploy](/docs/guides/blue-green#stop-blue). Once it isn't, delete it:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/action \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"servers\": [\"$VM_ID\"], \"cmd\": \"delete\" }"
```

Deleting a VM deletes the boot volume made from its image, and that can't be undone, so copy off anything you still need first. Volumes you attached later stay, and step 3 finds them.

## 2 · Floating IPs with nothing behind them {#unattached-ips}

A floating IP bills from the moment it's created until it's deleted, attached or not ([Floating IPs](/docs/api/floating-ips#billing)). Find the ones that aren't attached:

```bash
curl -s {{API_BASE_URL}}/api/v1/floating_ip/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | select(.port_id == null) | { id, ip_address, description }'
```

Delete the ones you don't need, listing their ids in `ids`:

```bash
curl -X DELETE {{API_BASE_URL}}/api/v1/floating_ip/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"ids\": [\"$FLOATING_IP_ID\"] }"
```

If something allowlists an address elsewhere, change that first: once you've deleted an address, you may not get it back.

## 3 · Volumes no VM is using {#volumes}

A volume bills the same whether it's attached or not ([Block storage](/docs/api/block-storage#lifecycle)). Volumes that outlive their VM are easy to forget. Find them:

```bash
curl -s {{API_BASE_URL}}/api/v1/storage/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | select(.status == "available") | { id, name, size, type }'
```

A deleted volume can't be recovered, so [back it up](/docs/api/backups#create) first if you might want the data. Then delete it:

```bash
curl -X DELETE {{API_BASE_URL}}/api/v1/storage/ \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{ \"ids\": [\"$VOLUME_ID\"] }"
```

## 4 · Over-provisioned VMs {#over-provisioned}

A VM's price depends on its `architecture`, `vm_class`, `cpu` and `ram`. If a VM's CPU and memory stay low all the time, it can run on a smaller shape. Measure before you decide: [Monitor a VM fleet](/docs/guides/monitoring-vms) sets up the metrics.

Resize with a new `spec`; [Quickstart](/docs/quickstart#region) shows where `$ARCHITECTURE` and `$VM_CLASS` come from. The VM restarts on the new shape and waits in `VERIFY_RESIZE`:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/$VM_ID/resize \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"spec\": {
      \"architecture\": \"$ARCHITECTURE\",
      \"vm_class\": \"$VM_CLASS\",
      \"cpu\": 2,
      \"ram\": 4096
    }
  }"
```

Check the VM under real load, then keep the new shape, or go back with `revert_resize`:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/instance/$VM_ID/confirm_resize \
  -H "X-API-Key: $NIMBUS_KEY"
```

[VM sizes](/docs/api/vm-sizes#resizing) has the details.

## 5 · Public ports and bandwidth {#bandwidth}

A port on the external network bills until you delete it, and its bandwidth bills with it, as does the bandwidth on a router's external gateway ([Network ports](/docs/api/network-ports), [Routers](/docs/api/routers)). A VM that doesn't need to be reachable from the internet can sit on a private network instead ([Project networking setup](/docs/guides/networking-setup)).

List the ports on the external network; `GET /api/v1/floating_ip/artifacts` lists the external networks:

```bash
curl -s "{{API_BASE_URL}}/api/v1/portal/port/?network_id=$EXTERNAL_NETWORK_ID" \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | { id, name, device_id, status }'
```

A port with an empty `device_id` isn't attached to anything. Delete it with `DELETE /api/v1/portal/port/{port_id}`.

If you need the port but not all of its bandwidth, lower it with `POST /api/v1/bandwidth/resize`, which changes the limit on a port, floating IP or router gateway, and its billing with it. `bandwidth_mbps` must be a multiple of 10:

```bash
curl -X POST {{API_BASE_URL}}/api/v1/bandwidth/resize \
  -H "X-API-Key: $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"resource_type\": \"port\",
    \"resource_id\": \"$PORT_ID\",
    \"bandwidth_mbps\": 100,
    \"bandwidth_subscription\": \"Monthly\"
  }"
```

## 6 · Custom images {#images}

A custom image is billed per GB, rounded up to a whole GB, as its own product ([VM images](/docs/api/vm-images)). List your private images, then delete the ones nothing boots from any more with `DELETE /api/v1/image/`:

```bash
curl -s "{{API_BASE_URL}}/api/v1/image/?visibility=private" \
  -H "X-API-Key: $NIMBUS_KEY" \
  | jq '.data[] | { id, name, size, created_at }'
```

## Looking at the bill itself {#invoice}

`GET /api/v1/billing/public/balances` shows your workspace's outstanding charges, promotional credit and prepaid balance, and `GET /api/v1/billing/public/accrued_charges` the total charged so far that hasn't been settled. These calls take a signed-in session, not an API key, and invoices themselves aren't available through the API ([Billing](/docs/api/invoices)).

## What's next {#next-steps}

- [Pricing data](/docs/api/pricing-data) — what each of these resources costs.
- [Billing](/docs/api/invoices) — your balances and the charges not yet settled.
- [VM sizes](/docs/api/vm-sizes) — shapes, and resizing in full.
- [Backups](/docs/api/backups) — copy a volume before you delete it, and how long schedules keep copies.
- [Quotas](/docs/api/quotas) — the per-project resource limits, which are separate from billing.
