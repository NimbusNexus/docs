---
title: Concept name
description: One-line description of what this concept is. Shown in the sidebar tooltip and SERPs.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: concept
---

<!-- TEMPLATE — copy this file before editing. Delete this comment when you do.

  Concept pages explain *how something works*. They're not API
  reference (that's the `reference` kind) and they're not
  step-by-step tutorials (that's `guide`). The goal is "after
  reading this, the reader has the right mental model."

  Length target: 600–1,200 words.

  Body structure:
    - 1–2 sentence framing paragraph (the question this page answers).
    - 5–8 H2 sections, each answering one sub-question.
    - Each H2 carries a stable `{#anchor}` so cross-references work.
    - Code examples wherever the concept is best illustrated by code.
      Always tag the language fence (```bash, ```ts, ```json, etc.).
    - Closing "What's next" with 3–5 cross-links.

  Tone: plain language. Show the *why*, not just the *what*. "Latency
  between regions is free" beats "Inter-region traffic incurs no
  charges." Skip marketing adjectives ("lightning-fast",
  "enterprise-grade") — they don't belong in conceptual docs.

  Reference pattern: link to API reference pages where the concept
  has a concrete API surface. The reader should be able to bounce
  from "concept" → "this is the endpoint that does it" in one click.

-->

# Concept name

A one- to two-sentence opening that frames the question this page answers. The first paragraph is what gets indexed for SERP snippets — make it count.

## First sub-question {#first}

One to three paragraphs answering one specific question about the concept. Each section is a self-contained unit; readers should be able to land on `/docs/concept#first` from a search result and get useful information without reading the whole page.

If the section benefits from a code example:

```ts
// Real, copy-pasteable code. No pseudocode unless absolutely necessary.
const example = await someApi.call()
```

## Second sub-question {#second}

Same pattern — one question per H2, anchored heading, one to three paragraphs of answer.

If the answer is best shown as a table, do that:

| Column A | Column B | Notes |
|---|---|---|
| Value | Value | Why this row matters |
| Value | Value | Why this row matters |

## Third sub-question {#third}

...

## What this isn't {#not}

For concepts that are easy to confuse with adjacent ideas, an explicit "what this isn't" section saves the reader from going down the wrong rabbit hole. Skip the section if no such confusion is likely.

## Common gotchas {#gotchas}

If there's a pattern that bites first-time readers ("don't forget to verify the signature before parsing the body" type things), surface it here rather than burying it inside a sub-section. Bulleted list works best.

## What's next {#next-steps}

- [Related concept](/docs/related-concept) — closely-related idea.
- [API reference](/docs/api/example) — the endpoint that implements this concept.
- [Conventions](/docs/conventions) — the broader patterns this fits into.
