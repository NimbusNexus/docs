---
title: Versioning policy
description: How we evolve the API without breaking your code.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: concept
---

# Versioning policy

The NimbusNexus API is on **v1**, and it will stay on v1 indefinitely. Breaking changes don't ship on top of v1 — they'd ship behind a new version (`v2`, etc.), and v1 would continue working unchanged. This is the same versioning posture Stripe, Twilio, and AWS take for their primary APIs.

## What's a breaking change {#breaking}

Anything that could make existing code stop working:

- Removing an endpoint
- Removing a field from a response
- Removing a status code from an endpoint's possible responses
- Renaming a field
- Changing a field's type (e.g. `string` → `number`)
- Changing default behavior of an existing endpoint
- Tightening request validation (a body that used to be accepted now rejected)
- Adding a new required request parameter

These never happen on `v1`. Period.

## What's an additive change {#additive}

Things we will ship on `v1` without warning:

- New endpoints
- New optional request parameters
- New fields on responses (you should ignore unknown fields when parsing)
- New error codes (you should treat unknown `error.code` values as the family of the status code)
- New webhook event types
- New enum values (you should treat unknown enum values as opaque)
- New status codes from the family the endpoint already returns

We document additive changes in the [changelog](/changelog) but don't gate them behind a flag. Existing code keeps working; new code can opt in.

## Forward compatibility — how to write code that survives {#forward-compat}

Three rules:

**1. Ignore unknown fields when parsing.** A response gaining a new field shouldn't be an error in your client. Most JSON libraries default to this behavior.

```ts
// Correct
const { id, name, state } = await res.json()

// Wrong (will reject responses with new fields)
const allowedKeys = ['id', 'name', 'state']
for (const k of Object.keys(json)) {
  if (!allowedKeys.includes(k)) throw new Error('unknown field')
}
```

**2. Treat unknown enums as opaque.** If you're branching on `state`, handle the known values; for unknowns, render the raw string and don't blow up.

```ts
switch (vm.state) {
  case 'running': return 'green'
  case 'stopped': return 'gray'
  case 'provisioning': return 'amber'
  default: return 'gray' // Don't throw, don't assume — we may add 'migrating'
}
```

**3. Switch on `error.code`, not `status`.** Status codes group errors (`4xx` vs `5xx`); `error.code` distinguishes them. We may add new codes to existing status codes; your code should default-case rather than treat unrecognized codes as fatal bugs.

## Deprecation policy {#deprecation}

We try hard not to need this on v1. If we ever do mark an endpoint or field deprecated:

- The endpoint or field keeps working unchanged for **at least 12 months**
- A `Deprecation` header is added to responses (RFC 9745)
- A `Sunset` header carries the end-of-life date
- The dashboard surfaces usage of deprecated endpoints per project

Twelve months is a long time. In practice, deprecated-on-v1 has happened zero times since launch — additive evolution covers most needs.

## When v2 ships {#v2}

If we ever ship v2 (we don't intend to soon), the rollout would be:

- v2 launched at `/v2/...` alongside `/v1/...` — both live in parallel
- v1 continues to receive bug fixes and new features (additive) for at least 24 months
- v2 carries a separate base URL (`{{API_BASE_URL}}/v2/...`) so the URL itself signals the version

You'd migrate when ready, not when forced. The path is to start using `/v2` endpoints in new code and migrate old code at your own pace — there's no flag-day cutover.

## Why this matters {#why}

A cloud platform whose API breaks every two years isn't trustworthy infrastructure. The reason v1 will outlive most other contracts on the platform: customer code, partner integrations, and SDK distribution all depend on this surface being stable. Breaking it without warning would be the single fastest way to lose trust.

If you ever see an actual breaking change on `v1` that wasn't behind a new version: that's a bug. Report it to support and we'll fix it.

## What's next {#next-steps}

- [Changelog](/changelog) — the running log of additive changes.
- [Authentication](/docs/authentication) — the most stable interface in the API.
- [Conventions](/docs/conventions) — request shape, status codes, error families.
