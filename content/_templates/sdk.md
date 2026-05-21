---
title: Language SDK
description: Typed client for the NimbusNexus REST API. Short summary of language + runtime + status.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: sdk
---

<!-- TEMPLATE — copy this file before editing. Delete this comment when you do.

  SDK pages document the language-specific client for the API.
  Every SDK page follows the same shape so a reader fluent in
  one language can navigate the docs for another by skimming.

  Length target: 600–1,200 words.

  Body structure (in this order):
    - Status banner (pre-release / GA / deprecated) as a > blockquote
      at the top of the body. Critical: don't bury whether the SDK
      ships today.
    - Short intro paragraph.
    - Install section with copy-pasteable command(s) for the
      idiomatic package managers in that ecosystem.
    - Quick usage example. A complete, runnable program showing the
      most common pattern (auth + one read + one write).
    - Design principles. The constraints that shape the API surface
      (typed end-to-end, mirrors REST, no runtime deps, etc.).
      Bulleted, short.
    - Configuration block — every constructor option with type +
      explanation. Stay aligned with what's available in the other
      SDK templates.
    - Helper sections (webhooks verification, pagination, errors)
      with one code example each.
    - "Where it stands today" section. Honest about what's shipped
      vs. what's promised.
    - "What's next" cross-links.

  Tone: prescriptive about the recommended pattern; honest about
  the trade-offs. The reader is choosing between this and writing
  raw HTTP calls — be clear about when each makes sense.

-->

# Language SDK

> **Status: pre-release / GA / deprecated.** One sentence summarizing the current state. If pre-release, mention what to use in the meantime.

A short paragraph describing the SDK — typed, runtime, generation source. Two or three sentences max.

## Install {#install}

```bash
# Idiomatic package manager for the language
package-manager add nimbusnexus
```

## Quick usage {#quick}

```language
// A complete, copy-pasteable example showing:
//  - import / require
//  - construction with the API key
//  - one read call
//  - one write call
// Real syntax. No placeholders for the API key in a way that would
// confuse a reader — make clear it comes from an env var.
```

## Design principles {#design}

- **Typed end-to-end.** What this means in this language.
- **Mirrors the REST API.** No bespoke convenience methods that drift from the API.
- **Idempotency by default.** What the SDK generates automatically vs. what the caller overrides.
- **Retries 429 + 5xx.** Default policy + how to disable.
- **Other language-specific principles** (no runtime deps, context-aware, async-first, etc.).

## Configuration {#config}

```language
const client = new NimbusNexus({
  apiKey: ...,
  // every option with type + one-line explanation
})
```

## Webhook verification helper {#webhooks}

```language
// HMAC-SHA256 + constant-time comparison + replay-window check.
// Don't roll your own — getting it wrong is the standard webhook-
// spoofing pattern.
```

## Pagination helper {#pagination}

```language
// Auto-flatten over cursor walks. See /docs/pagination for the
// underlying mechanics.
```

## Errors {#errors}

```language
// Typed exception / error hierarchy mapping to error.code values.
// See /docs/errors for the canonical list.
```

## Where it stands today {#status}

Be honest:

- What's published vs. what's in design
- Where to follow for release announcements (changelog)
- What to do in the meantime (use the REST API directly)

## What's next {#next-steps}

- [Authentication](/docs/authentication) — what `apiKey` does on the wire.
- [Webhooks](/docs/webhooks) — what the verification helper is checking.
- [Pagination](/docs/pagination) — what the pagination helpers walk.
- [Errors](/docs/errors) — the codes that map to the typed errors above.
