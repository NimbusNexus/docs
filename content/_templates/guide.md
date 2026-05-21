---
title: Do the thing in N minutes
description: One-line description of what this guide accomplishes. Shown in sidebar and SERPs.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: guide
---

<!-- TEMPLATE — copy this file before editing. Delete this comment when you do.

  Guides are worked-through scenarios. The reader has a specific
  outcome in mind ("run a production Postgres", "deploy a static
  site", "migrate from AWS RDS"); the guide walks them through it
  step by step.

  Length target: 800–1,500 words.

  Body structure:
    - Outcome paragraph: "By the end of this guide you'll have X."
      List the concrete deliverables (bullets if more than three).
    - Prereqs section. What does the reader need before starting?
      Account, API key, region picked, CLI installed, etc.
    - Numbered H2 sections: `## 1 · Step name`, `## 2 · Step name`, …
      Each step is one focused action. The number prefix shows up in
      the right-rail TOC and signals "this is sequential."
    - "What you've done" / "Summary" section recapping the outcome.
    - "Next steps" with 4–8 cross-links: deeper docs, related guides,
      "what to do next in production".

  Code style:
    - Always tag fenced code blocks with a language.
    - Use `{{API_BASE_URL}}` etc. for canonical hostnames — never
      hardcode `https://api.nimbusnexus.net`.
    - Save intermediate values with `export VAR_NAME=...` so the
      next code block can reference them. Real shell-script style.

  Tone: plain language. "Here's what to do; here's why; here's the
  thing to watch out for." Avoid marketing speak.

-->

# Do the thing in N minutes

By the end of this guide you'll have:

- A short, concrete bullet list of what the reader will have at the end
- Each bullet is one observable deliverable, not a vague claim ("a fast app", etc.)
- Three to five bullets covers most guides

Total time: about N minutes (most of which is *whatever takes longest*).

## Prereqs {#prereqs}

- A NimbusNexus account with an API key. See [Quickstart](/docs/quickstart) if you don't have one yet.
- Anything else the reader needs before starting (CLI installed, a region picked, an existing resource, etc.).
- Set up shell variables the rest of the guide will reference:

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export REGION="us-east-1"
```

## 1 · First step {#first-step}

One paragraph explaining what this step accomplishes and why.

```bash
curl -X POST {{API_BASE_URL}}/v1/example \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "example" }'
```

What each notable option does:

- `name: 'example'` — what the field controls + when to choose differently
- `another_field: ...` — same pattern

If the step produces an identifier the next step needs, save it:

```bash
export EXAMPLE_ID="ex_01HG7Y3..."
```

## 2 · Second step {#second-step}

One paragraph per step. Code where code is what's needed.

If the step has a long-running aspect (provisioning, sync, etc.), call it out plainly: "this takes 4–7 minutes." Don't make the reader figure it out.

## 3 · Third step {#third-step}

...

## What you've done {#summary}

One short paragraph recapping the outcome. Reaffirm the deliverables from the opening. Mention the cost (per-month, per-hour) if it's the kind of guide where a reader will care.

## Next steps {#next-steps}

- [Related reference](/docs/api/example) — the API surface this guide touched.
- [Adjacent guide](/docs/guides/example) — the next thing a reader might want to do.
- [Concept](/docs/related-concept) — the conceptual background for going deeper.
- [Cleanup commands](/docs/api/example#delete) — if you were testing rather than building, here's how to tear it down.
