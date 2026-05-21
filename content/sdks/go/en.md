---
title: Go SDK
description: Idiomatic Go client for the NimbusNexus REST API. Context-aware, no dependencies.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: sdk
---

# Go SDK

> **Status: pre-release.** The SDK is in active development. This page documents the v1.0 shape; until the module is published, use the REST API directly per [Authentication](/docs/authentication) and [Conventions](/docs/conventions).

An idiomatic Go client. Context-aware, no runtime dependencies, generated from the OpenAPI spec. Targets Go 1.22+.

## Install (when shipped) {#install}

```bash
go get github.com/nimbusnexus/nimbusnexus-go
```

## Quick usage {#quick}

```go
package main

import (
    "context"
    "log"
    "os"
    "time"

    nn "github.com/nimbusnexus/nimbusnexus-go"
)

func main() {
    client := nn.NewClient(nn.Config{
        APIKey: os.Getenv("NIMBUS_KEY"),
    })

    ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
    defer cancel()

    // List VMs
    page, err := client.VMs.List(ctx, &nn.VMListParams{
        Region: nn.String("us-east-1"),
        Limit:  nn.Int(50),
    })
    if err != nil { log.Fatal(err) }

    for _, vm := range page.Items {
        log.Println(vm.ID, vm.Name, vm.State)
    }

    // Create a VM
    vm, err := client.VMs.Create(ctx, &nn.VMCreateParams{
        Name:   "web-01",
        Size:   "gp-1-2",
        Region: "us-east-1",
        Image:  "ubuntu-24.04",
    })
    if err != nil { log.Fatal(err) }
    log.Println("created", vm.ID)
}
```

## Design principles {#design}

- **Context everywhere.** Every API call takes a `context.Context`. No default-context shortcuts. Cancel a slow request by canceling its context.
- **Mirrors the REST API.** `client.VMs.List(ctx, ...)` is `GET /v1/vms`. Resource groups follow the URL — `client.Databases.Snapshots.List(ctx, dbID, ...)` is `GET /v1/databases/{db_id}/snapshots`.
- **Zero runtime dependencies.** Only standard library. We're explicit about not pulling in `viper`, `cobra`, or any opinionated companion — those are your call.
- **Idiomatic params with pointers.** Optional fields are pointers (`*string`, `*int`); use the helpers `nn.String("...")`, `nn.Int(42)`, `nn.Bool(true)` to take addresses of literals.
- **Idempotency by default.** Mutating calls auto-generate a UUID `IdempotencyKey`. Override via `nn.VMCreateParams{ IdempotencyKey: nn.String("...") }`.
- **Retries 429 + 5xx.** Default config retries with exponential backoff + jitter. Disable with `nn.Config{ MaxRetries: -1 }`.

## Configuration {#config}

```go
client := nn.NewClient(nn.Config{
    APIKey:       os.Getenv("NIMBUS_KEY"),
    BaseURL:      "{{API_BASE_URL}}", // defaults to canonical
    Timeout:      30 * time.Second,
    MaxRetries:   3,
    RetryBackoff: time.Second,        // base; doubled per attempt with jitter
    UserAgent:    "my-app/2.4",       // appended to the default UA
    HTTPClient:   customClient,       // optional *http.Client override
})
```

## Webhook verification helper {#webhooks}

```go
import "github.com/nimbusnexus/nimbusnexus-go/webhooks"

func handleWebhook(w http.ResponseWriter, r *http.Request) {
    body, err := io.ReadAll(r.Body)
    if err != nil { http.Error(w, "bad body", 400); return }

    ok := webhooks.Verify(webhooks.VerifyParams{
        Body:      body,
        Timestamp: r.Header.Get("NN-Timestamp"),
        Signature: r.Header.Get("NN-Signature"),
        Secret:    os.Getenv("NIMBUS_WEBHOOK_SECRET"),
    })
    if !ok {
        http.Error(w, "bad signature", 401)
        return
    }

    // handle event...
    w.WriteHeader(200)
}
```

The verifier uses `crypto/hmac.Equal` for constant-time comparison and enforces a 5-minute replay window via the `NN-Timestamp` header.

## Pagination helper {#pagination}

```go
// Manual paging
iter := client.VMs.ListPages(ctx, &nn.VMListParams{Region: nn.String("us-east-1")})
for iter.Next() {
    page := iter.Page()
    log.Printf("got %d VMs", len(page.Items))
}
if err := iter.Err(); err != nil { log.Fatal(err) }

// Auto-flatten — yields one resource per iteration
all := client.VMs.ListAll(ctx, &nn.VMListParams{Region: nn.String("us-east-1")})
for all.Next() {
    vm := all.Value()
    log.Println(vm.Name)
}
if err := all.Err(); err != nil { log.Fatal(err) }
```

Both iterators handle the cursor walk for you. See [Pagination](/docs/pagination) for the mechanics.

## Errors {#errors}

The SDK exposes a typed error type for every [`error.code`](/docs/errors):

```go
vm, err := client.VMs.Create(ctx, &nn.VMCreateParams{
    Name:   "web-01",
    Size:   "gp-1-2",
    Region: "us-east-1",
    Image:  "ubuntu-24.04",
})
if err != nil {
    var validation *nn.ValidationError
    if errors.As(err, &validation) {
        for field, problem := range validation.Fields {
            log.Printf("  %s: %s", field, problem)
        }
        return
    }

    var rate *nn.RateLimitError
    if errors.As(err, &rate) {
        log.Printf("slow down — wait %s", rate.RetryAfter)
        return
    }

    log.Fatal(err)
}
```

Error types: `AuthenticationError`, `PermissionError`, `ValidationError`, `NotFoundError`, `ConflictError`, `RateLimitError`, `ServerError`. All implement the standard `error` interface and unwrap to `*nn.APIError` (the underlying error envelope).

## Where it stands today {#status}

The SDK is being generated from the OpenAPI spec but hasn't been published yet. While you wait:

- Use the REST API directly. Auth + conventions are documented and stable.
- The shape on this page is the API design we're committing to.
- Subscribe to the [changelog]({{BASE_URL}}/changelog) for the release announcement.

## What's next {#next-steps}

- [Authentication](/docs/authentication) — what `APIKey` does on the wire.
- [Webhooks](/docs/webhooks) — what `webhooks.Verify` is checking.
- [Pagination](/docs/pagination) — what the iterators are walking.
- [Errors](/docs/errors) — the codes that map to the typed error types above.
