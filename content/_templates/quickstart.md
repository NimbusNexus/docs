---
title: Quickstart name
description: One-line description of what the reader will accomplish. Shown in sidebar and SERPs.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: quickstart
---

<!-- TEMPLATE — copy this file before editing. Delete this comment when you do.

  Quickstarts are the shortest possible path from "I want to try X"
  to "X is running." They're tighter than guides — every paragraph
  earns its place.

  Length target: 400–700 words. If you find yourself going longer,
  the page is probably trying to be a guide; switch templates.

  Body structure:
    - Outcome paragraph: "By the end of this quickstart you'll have X
      in about N minutes."
    - "Before you start" section listing prereqs (very short — usually
      just the account + API key + region).
    - Numbered H2 sections: `## 1 · Step name`, `## 2 · Step name`, …
      Three is typical, five is the max — past that, it's a guide.
    - "What you've done" or "What's next" closing.

  Code-block density: high. Most steps should be a single command
  followed by a short explanation, not multiple commands per step.

  Tone: encouraging without being condescending. The reader wants
  to feel they're making progress, not being lectured. Skip the
  "in this section we will..." prose — get to the command.

-->

# Quickstart name

A one- to two-sentence outcome statement. Be concrete: "By the end of this quickstart you'll have a managed Postgres cluster reachable from your laptop" beats "you'll explore the database surface."

Total time: about N minutes. Most of that is *whatever the long step is* — the actual reading + typing is small.

## Before you start {#prereqs}

You need:

- A NimbusNexus account. Sign up at [{{ROOT_DOMAIN}}]({{BASE_URL}}/register) — the starter credit covers this quickstart and then some.
- An API key. See [Authentication](/docs/authentication) if you don't have one.
- About N minutes.

Set the variables we'll reference:

```bash
export NIMBUS_KEY="nn_live_xxxxxxxxxxxxxxxx"
export REGION="us-east-1"
```

## 1 · First step {#first}

One paragraph framing what this step does.

```bash
curl -X POST {{API_BASE_URL}}/v1/example \
  -H "Authorization: Bearer $NIMBUS_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "name": "quickstart" }'
```

A short explanation of the response shape if needed (skip if obvious).

## 2 · Second step {#second}

Same pattern. Short framing paragraph, then a command, then a one-line explanation.

## 3 · Final step {#final}

Final action, often a verification step that proves the previous steps worked.

```bash
curl {{API_BASE_URL}}/v1/example/$EXAMPLE_ID \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

You should see a response with `state: "running"` (or whatever the equivalent is).

## What you've done {#summary}

One paragraph recapping what the reader accomplished. List the concrete things they now have.

## Next steps {#next-steps}

- [Related guide](/docs/guides/example) — go deeper on the same resource.
- [API reference](/docs/api/example) — every option for the calls above.
- [Related concept](/docs/related-concept) — the conceptual background.
- Cleanup: if you were just testing, delete the resource with:

  ```bash
  curl -X DELETE {{API_BASE_URL}}/v1/example/$EXAMPLE_ID \
    -H "Authorization: Bearer $NIMBUS_KEY"
  ```
