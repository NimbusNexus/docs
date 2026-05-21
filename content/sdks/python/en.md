---
title: Python SDK
description: Typed Python client for the NimbusNexus REST API. Python 3.11+, sync + async.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: sdk
---

# Python SDK

> **Status: pre-release.** The SDK is in active development. This page documents the v1.0 shape; until the package is published, use the REST API directly per [Authentication](/docs/authentication) and [Conventions](/docs/conventions).

A typed Python client. Sync + async (httpx-backed), Python 3.11+, full Pydantic models for every response shape.

## Install (when shipped) {#install}

```bash
pip install nimbusnexus
# or
uv add nimbusnexus
# or
poetry add nimbusnexus
```

## Quick usage {#quick}

```python
import os
from nimbusnexus import NimbusNexus

nn = NimbusNexus(api_key=os.environ["NIMBUS_KEY"])

# List VMs in a region
page = nn.vms.list(region="us-east-1", limit=50)
for vm in page.items:
    print(vm.id, vm.name, vm.state)

# Create a VM
vm = nn.vms.create(
    name="web-01",
    size="gp-1-2",
    region="us-east-1",
    image="ubuntu-24.04",
)

# Poll until running
while vm.state != "running":
    time.sleep(1)
    vm = nn.vms.get(vm.id)
```

## Async client {#async}

```python
import asyncio
from nimbusnexus import AsyncNimbusNexus

async def main():
    nn = AsyncNimbusNexus(api_key=os.environ["NIMBUS_KEY"])
    async with nn:
        vm = await nn.vms.create(
            name="web-01",
            size="gp-1-2",
            region="us-east-1",
            image="ubuntu-24.04",
        )
        print(vm.id)

asyncio.run(main())
```

The sync and async clients share the same surface (every method name + signature matches); pick whichever fits your runtime. The async client is httpx-backed and recommended for any I/O-bound workload.

## Design principles {#design}

- **Typed with Pydantic.** Every response is a Pydantic model; mypy/pyright see full types. Request kwargs are validated before they go out — typos in field names fail at call time, not after a 400.
- **Mirrors the REST API.** `nn.vms.list()` is `GET /v1/vms`. `nn.databases.snapshots.list(db_id)` is `GET /v1/databases/{db_id}/snapshots`. No bespoke convenience methods that drift from the API.
- **Idempotency by default.** Every mutating call generates an `Idempotency-Key` (UUID v4). Override with `idempotency_key="..."` for stable keys across retries.
- **Retries 429 + 5xx.** Configurable backoff + jitter, off by default for raw requests; on by default for the high-level resource methods.
- **No httpx dependency for sync.** Sync client is `urllib3`-based, no extra deps. Async client depends on httpx.

## Configuration {#config}

```python
nn = NimbusNexus(
    api_key=os.environ["NIMBUS_KEY"],
    base_url="{{API_BASE_URL}}",  # defaults to canonical
    timeout=30,                    # seconds
    max_retries=3,
    retry_backoff=1.0,             # base; doubled per attempt with jitter
    user_agent="my-app/2.4",       # appended to the default UA
)
```

## Webhook verification helper {#webhooks}

```python
from nimbusnexus.webhooks import verify_webhook
from flask import request, abort

@app.route("/webhooks/nimbusnexus", methods=["POST"])
def webhook():
    if not verify_webhook(
        body=request.get_data(),
        timestamp=request.headers["NN-Timestamp"],
        signature=request.headers["NN-Signature"],
        secret=os.environ["NIMBUS_WEBHOOK_SECRET"],
    ):
        abort(401)

    event = request.get_json()
    # handle event...
    return "", 200
```

The verifier handles HMAC-SHA256 + constant-time comparison + replay-window check. Don't roll your own; it's where most webhook-spoofing bugs live.

## Pagination helper {#pagination}

```python
# Manual paging
for page in nn.vms.list_pages(region="us-east-1"):
    print(f"got {len(page.items)} VMs")

# Auto-flatten — yields one resource per iteration
for vm in nn.vms.list_all(region="us-east-1"):
    print(vm.name)
```

Both return iterators that handle the cursor walk for you. See [Pagination](/docs/pagination) for the underlying mechanics.

## Errors as exceptions {#errors}

The SDK raises a typed exception hierarchy mirroring the [error codes](/docs/errors):

```python
from nimbusnexus.errors import (
    NimbusError,                # base class
    AuthenticationError,        # 401 + invalid_credentials / expired_credentials
    PermissionError,            # 403 + scope_required / wrong_project
    ValidationError,            # 400 + validation_failed (carries .fields)
    NotFoundError,              # 404
    ConflictError,              # 409
    RateLimitError,             # 429 (carries .retry_after_seconds)
    ServerError,                # 5xx — retryable
)

try:
    vm = nn.vms.create(name="web-01", size="gp-1-2", region="us-east-1", image="ubuntu-24.04")
except ValidationError as e:
    for field, problem in e.fields.items():
        print(f"  {field}: {problem}")
except RateLimitError as e:
    print(f"slow down — wait {e.retry_after_seconds}s")
```

## Where it stands today {#status}

The SDK is being generated from the OpenAPI spec but hasn't been published yet. While you wait:

- Use the REST API directly. Auth + conventions are documented and stable.
- The shape on this page is the API design we're committing to.
- Subscribe to the [changelog]({{BASE_URL}}/changelog) for the release announcement.

## What's next {#next-steps}

- [Authentication](/docs/authentication) — what `api_key` does on the wire.
- [Webhooks](/docs/webhooks) — what `verify_webhook` is checking.
- [Pagination](/docs/pagination) — what `list_all` and `list_pages` are walking.
- [Errors](/docs/errors) — the error codes that map to the exception classes above.
