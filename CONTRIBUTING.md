# Contributing to NimbusNexus docs

Thanks for fixing a typo, clarifying an example, or adding a missing page.
This file is the contract: follow it and your PR will sail through CI.

## Page shape

Every `.md` file in `content/` has the same shape:

```markdown
---
title: Floating IPs
description: Region-scoped public IPs that can be detached from one VM and reattached to another.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: reference
---

# Floating IPs

A short, plain-English intro paragraph. One or two sentences, max three.

## A heading {#stable-anchor}

Section body.

## What's next {#next-steps}

- [Virtual machines](/docs/api/vms) — link to a related page.
```

### Frontmatter fields

| Field          | Required | Type     | Notes |
|----------------|----------|----------|-------|
| `title`        | yes      | string   | Page title; shown in the sidebar, the `<h1>`, and the OG card |
| `description`  | yes      | string   | One-line meta description; appears in SERPs and the sidebar tooltip |
| `publishedAt`  | yes      | ISO date | When the page first went live; never changes after publication |
| `updatedAt`    | yes      | ISO date | Update on every meaningful content change |
| `kind`         | yes      | enum     | One of: `concept`, `reference`, `quickstart`, `guide`, `sdk`, `cli` |
| `openApiTag`   | no       | string   | When set, the page auto-renders endpoint cards from the OpenAPI spec for that tag |
| `toc`          | no       | array    | Manual table of contents; if omitted, derived from `## H2` headings |

### Anchor convention

Every `## H2` heading should carry a stable anchor:

```markdown
## Region scoping {#region}
```

The anchor is what `/docs/...#region` URL fragments target. Auto-derived
slugs (when you omit the `{#…}`) work too, but they can change if you
rename the heading — explicit anchors are stable for life.

### Placeholders

The frontend interpolates Mustache-style `{{NAME}}` placeholders against
the canonical NimbusNexus config at render time. Use these so your prose
stays in sync with the apex domain and other canonical values:

| Placeholder                   | Value                                          |
|-------------------------------|------------------------------------------------|
| `{{ROOT_DOMAIN}}`             | `nimbusnexus.net`                              |
| `{{BASE_URL}}`                | `https://nimbusnexus.net`                      |
| `{{API_BASE_URL}}`            | `https://api.nimbusnexus.net`                  |
| `{{API_HOST}}`                | `api.nimbusnexus.net`                          |
| `{{AUTH_BASE_URL}}`           | `https://auth.nimbusnexus.net`                 |
| `{{STATUS_URL}}`              | `https://status.nimbusnexus.net`               |
| `{{DNS_NS1}}`–`{{DNS_NS4}}`   | `ns1.dns.nimbusnexus.net` … `ns4.dns.nim…`     |
| `{{S3_ENDPOINT_US_EAST_1}}`   | `https://s3.us-east-1.nimbusnexus.net`         |
| `{{S3_HOST_US_EAST_1}}`       | `s3.us-east-1.nimbusnexus.net`                 |
| `{{DB_HOST_DEMO}}`            | `db-postgres-prod-01.us-east-1.nimbusnexus.net` |

Use them anywhere in body prose, code blocks, link hrefs, frontmatter
descriptions. The validator catches unknown placeholders before they
ship.

```markdown
Send the key in the `Authorization` header:

curl {{API_BASE_URL}}/v1/vms \
  -H "Authorization: Bearer $NIMBUS_KEY"
```

### Code blocks

- Always set a language: ` ```bash `, ` ```json `, ` ```ts `, ` ```yaml `.
- Use `$NIMBUS_KEY` (no braces) for shell environment variables — `{...}`
  collides with the placeholder syntax.
- Keep examples copy-pasteable. If you say a curl prints JSON, show that
  JSON below the block.

## Adding a new page

**Start by copying a template.** Don't write a new page from scratch
— the templates encode shape decisions (section anchors, intro
length, "What's next" footer, kind-specific structure) that drive
the sidebar nav, the right-rail TOC, and the rendered breadcrumb.

1. **Pick the URL.** It's the file path. `content/api/load-balancers/en.md`
   becomes `/docs/api/load-balancers`. Multi-segment paths like
   `sdks/typescript` work — just nest the directory.

2. **Pick a template by page kind:**

   | Kind          | Template                       | For                                              |
   |---------------|--------------------------------|--------------------------------------------------|
   | `reference`   | `content/_templates/reference.md`  | API reference, one per resource                  |
   | `concept`     | `content/_templates/concept.md`    | Conceptual explainers                            |
   | `guide`       | `content/_templates/guide.md`      | Step-by-step worked-through tutorials            |
   | `quickstart`  | `content/_templates/quickstart.md` | Onboarding flows ("run X in 5 minutes")          |
   | `sdk`         | `content/_templates/sdk.md`        | Language-specific SDK docs                       |
   | `cli`         | `content/_templates/cli.md`        | Command-line tool docs                           |

   ```bash
   cp content/_templates/reference.md content/api/load-balancers/en.md
   ```

   See [`content/_templates/README.md`](./content/_templates/README.md)
   for the full per-kind structure breakdown.

3. **Add a manifest entry.** Open `manifest.json` and add your page
   under the right section. Order in the file is the sidebar order.

   ```jsonc
   {
     "path": "api/load-balancers",
     "title":       { "en": "Load balancers" },
     "description": { "en": "VIP-fronted load balancers across N targets." },
     "kind": "reference",
     "openapiTag": "load_balancers",
     "published": true
   }
   ```

4. **Edit your new page.** Delete the top-line
   `<!-- TEMPLATE — copy this file ... -->` block — the lint
   workflow rejects any committed page outside `_templates/` that
   still has it. Then fill in the body following the template's
   inline guidance.

5. **Validate.** `npm run lint`. If it passes, open a PR.

## Validation (what CI checks)

- **Frontmatter** — every page parses against the Zod schema (same one
  the frontend uses).
- **Markdownlint** — formatting consistency (heading spacing, list style,
  trailing whitespace, etc.).
- **Placeholders** — every `{{NAME}}` references a known placeholder.
- **Template markers** — committed pages outside `_templates/` must
  not contain a leftover `<!-- TEMPLATE — copy this file ... -->`
  block. Catches "copied a template, forgot to delete the marker"
  before it ships.
- **Link check** — every internal `/docs/...` and external `https://...`
  resolves. Catches cross-references that break when a page renames.

Run all five locally:

```bash
npm install
npm run lint
```

## Tone

NimbusNexus docs are written for someone reading on the job. Three rules:

1. **Plain language wins.** "Latency between regions is free" beats
   "Inter-region traffic incurs no charges."
2. **Show the why.** When a constraint exists, explain it — it makes
   the constraint feel less arbitrary and helps readers decide if it
   applies to them.
3. **Skip the marketing.** Adjectives like "lightning-fast,"
   "best-in-class," "enterprise-grade" don't belong in reference docs.
   Numbers and behavior do.

## Licensing

By contributing you agree to license your contributions under the
repository's [`LICENSE`](./LICENSE) (CC-BY-4.0). You retain copyright
to your contributions; we get a license to publish them.

If your change is more than 50 lines, please mention in your PR whether
your employer has an interest in your work (most don't, but it's
worth a one-line confirmation).

## Questions

- **For docs content questions:** open an issue with the "content
  request" template.
- **For product questions:** <https://nimbusnexus.net/contact/support>.
- **For security disclosures:** see
  <https://nimbusnexus.net/contact/security> — don't put security
  details in a public PR.
