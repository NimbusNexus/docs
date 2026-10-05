---
title: Python SDK
description: Typed Python client for the NimbusNexus REST API. Python 3.11+, sync + async.
publishedAt: 2026-05-20
updatedAt: 2026-10-05
kind: sdk
---

# Python SDK

> **Status: pre-release.** The SDK is in active development. This page documents the v1.0 shape; until the package is published, use the REST API directly per [Authentication](/docs/authentication) and [Conventions](/docs/conventions).

A typed Python client. Sync + async (httpx-backed), Python 3.11+, full Pydantic models for every response shape.

> **Sending webhooks to your own customers?** That is the separate [Webhooks product](/docs/product-webhooks), which has its own published Python SDK: the package `nn-webhooks-sdk`, imported as `nn_webhooks` ([Webhooks SDKs](/docs/product-webhooks/sdks)). This page is the client for the NimbusNexus cloud API.

## Install {#install}

The client on this page isn't published yet, and there is no `nimbusnexus` package on PyPI, so don't install one under that name. (Earlier versions of this page showed `pip install nimbusnexus`.)

The Python package we publish today is the Webhooks SDK:

```bash
pip install nn-webhooks-sdk
# or
uv add nn-webhooks-sdk
# or
poetry add nn-webhooks-sdk
```

It installs the module `nn_webhooks` (`from nn_webhooks import Client`), for Python 3.11 and later.

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

### In the published Webhooks SDK {#errors-webhooks-sdk}

`nn-webhooks-sdk` has two exception classes, both in `nn_webhooks.errors`:

| Class | Raised when | Carries |
|---|---|---|
| `WebhooksError` | The base class. Raised itself for a network failure that persists after retries, and for misuse such as calling `enqueue()` on a `Client` built without a store. | A message |
| `WebhooksAPIError` | The API answered with a non-2xx status. A subclass of `WebhooksError`. | `status_code`, `code`, `message` |

There is no class per code. `code` is the API's `error.code`, passed through unchanged, so switch on it using the codes listed on [Errors](/docs/errors). If a response has no JSON error body (a gateway `502`, say), `code` is `"error"` and `message` is the raw response text. `details` isn't carried. A `429`, `500`, `502`, `503` or `504` is retried up to `max_retries` times (default 2), honouring `Retry-After`; after that the `WebhooksAPIError` is raised. Any other `4xx` or `5xx`, a `501` included, raises at once.

```python
from nn_webhooks import Client, WebhooksAPIError

with Client("{{WEBHOOKS_BASE_URL}}", api_key=WEBHOOKS_API_KEY) as wh:
    try:
        wh.publish("order.created", {"order_id": "ord_123"}, idempotency_key="order-123")
    except WebhooksAPIError as e:
        if e.code in ("validation_error", "unknown_event_type", "invalid_payload"):
            ...  # fix the request; sending it again won't help
        elif e.code == "quota_exceeded":
            ...  # monthly delivery quota: wait for the next period, or upgrade
        elif e.code == "invalid_credential":
            ...  # replace the key
        else:
            print(e.status_code, e.code, e.message)
```

A renamed code is handled under the [deprecation policy](/docs/versioning#deprecation): the rename is announced in the [changelog](/changelog), and the old spelling keeps arriving in `code` for at least 12 months.

### In the cloud API client (planned) {#errors-planned}

The client on this page will raise one class per status family. Each carries `status_code`, `code`, `message` and `details` exactly as the API sends them:

```python
from nimbusnexus.errors import (
    NimbusError,                # base class
    AuthenticationError,        # 401 unauthorized, 403 invalid_credential
    PermissionError,            # 403 forbidden
    PlanError,                  # 402 quota_exceeded, not_entitled, workspace_frozen, ...
    ValidationError,            # 422 validation_error (carries .details)
    NotFoundError,              # 404 not_found
    ConflictError,              # 409 conflict
    RateLimitError,             # 429 rate_limited (carries .retry_after_seconds)
    ServerError,                # 5xx — retryable
)

try:
    vm = nn.vms.create(name="web-01", size="gp-1-2", region="us-east-1", image="ubuntu-24.04")
except ValidationError as e:
    for entry in e.details:
        print(f"  {entry['loc']}: {entry['msg']}")
except RateLimitError as e:
    print(f"slow down — wait {e.retry_after_seconds}s")
```

Earlier versions of this page mapped these classes to `invalid_credentials`, `expired_credentials`, `scope_required`, `wrong_project` and a `400 validation_failed` carrying `.fields`. The APIs have never sent those; the comments above use the codes they do send.

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
