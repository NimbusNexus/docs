---
title: Set up the REST API
description: Get an API key, send it in one header, and make a first call to a NimbusNexus product from curl, TypeScript, Python or Go.
publishedAt: 2026-10-19
updatedAt: 2026-10-22
kind: quickstart
---

# Set up the REST API

Every NimbusNexus product is a REST API: JSON over HTTPS, with your API key in the `Authorization` header. This page takes you from no key to a first successful call. Pick a language at the top of the page and the examples follow it. REST means `curl`; TypeScript, Python and Go use each language's usual HTTP client, with no SDK needed.

## 1 · Get an API key {#key}

**Apps: Webhooks, Inboxes, QR Codes and Request Bins.** Open **API keys** in your [account console]({{ACCOUNT_BASE_URL}}/api-keys) and create a key for the product you want to call. Each key belongs to one product. Choose its scope there: `admin`, `read`, or for Webhooks also `publish`. Copy the key when it appears, because it is shown only once. An app key is a JWT, so it starts with `eyJ`.

**Infrastructure: VMs, storage, databases and networking.** Create the key in the dashboard under **Settings → API keys**. It is scoped to one project. [Authentication](/docs/authentication) covers scopes and rotation.

Keep the key out of your source code. Export it in your shell or keep it in your secret store:

```bash
export WEBHOOKS_API_KEY="<your-api-key>"
```

## 2 · Send it on every request {#auth}

Send the key as a bearer token. The app APIs also accept it as `X-API-Key: <key>`.

```http
Authorization: Bearer <your-api-key>
```

Each product has its own base URL:

| Product | Base URL |
| --- | --- |
| Webhooks | `{{WEBHOOKS_BASE_URL}}/v1` |
| Inboxes | `{{INBOXES_BASE_URL}}/v1` |
| QR Codes | `{{QR_BASE_URL}}/v1` |
| Request Bins | `https://bins.nimbusnexus.net/v1` |
| Infrastructure | `{{API_BASE_URL}}` |

## 3 · Make a first call {#first-call}

`GET /v1/auth/me` on Webhooks returns the key you sent: its scope and the workspace it belongs to. It reads nothing else, so any valid key can call it.

```bash
curl {{WEBHOOKS_BASE_URL}}/v1/auth/me \
  -H "Authorization: Bearer $WEBHOOKS_API_KEY"
```

```ts
const res = await fetch('{{WEBHOOKS_BASE_URL}}/v1/auth/me', {
  headers: { Authorization: `Bearer ${process.env.WEBHOOKS_API_KEY}` },
})
console.log(await res.json())
```

```python
import os
import requests

res = requests.get(
    "{{WEBHOOKS_BASE_URL}}/v1/auth/me",
    headers={"Authorization": f"Bearer {os.environ['WEBHOOKS_API_KEY']}"},
)
print(res.json())
```

```go
req, err := http.NewRequest("GET", "{{WEBHOOKS_BASE_URL}}/v1/auth/me", nil)
if err != nil {
    log.Fatal(err)
}
req.Header.Set("Authorization", "Bearer "+os.Getenv("WEBHOOKS_API_KEY"))
res, err := http.DefaultClient.Do(req)
if err != nil {
    log.Fatal(err)
}
defer res.Body.Close()
```

The response names your workspace:

```json
{
  "scope": "admin",
  "workspace_id": "{{WORKSPACE_ID}}"
}
```

The other fields say what kind of credential this is. For an API key, `email` and `created_at` are `null`.

## 4 · Read errors {#errors}

A failed request answers with a 4xx or 5xx status and one error shape across every product:

```json
{
  "error": {
    "code": "unauthorized",
    "message": "…",
    "details": { "reason": "missing" },
    "request_id": "…"
  }
}
```

Branch on `code`, not on the status or the message. `unauthorized` means no key arrived or the key was revoked. `invalid_credential` means the key is not valid: mint a new one, because retrying will not help. `forbidden` means the key is valid but cannot do this: its scope or role is missing, or the product is not enabled for your workspace. [Authentication](/docs/authentication#errors) and [Errors](/docs/errors) list every code. Quote the `request_id` when you contact support.

## What's next {#next-steps}

- [API reference](/docs/reference): every operation of every product, with the call in your language.
- [SDKs](/docs/setup/sdk) and the [CLI](/docs/setup/cli): the same calls with retries, signature checks and pagination handled for you.
- Product quickstarts: [Webhooks](/docs/product-webhooks/quickstart), [Inboxes](/docs/product-inboxes/quickstart), [Request Bins](/docs/product-bins/quickstart), [your first VM](/docs/quickstart).
