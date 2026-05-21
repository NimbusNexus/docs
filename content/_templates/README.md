---
title: Page templates
description: Internal — canonical structure per page kind. Not rendered.
publishedAt: 2026-05-20
updatedAt: 2026-05-20
kind: concept
---

<!-- TEMPLATE-DIR: this README is a non-rendered index. The .md files
     beside it are templates authors copy to start a new page. The
     manifest.json never references anything in this directory, so
     nothing here gets rendered to a public URL. -->

# Page templates

This directory holds the canonical starting point for each docs page
kind. When you're about to write a new page, **copy the template that
matches your page kind** to the destination first, then edit. Don't
write from scratch — the templates encode shape decisions (frontmatter
fields, section anchors, "What's next" footer) that the docs surface
relies on for consistency, sidebar navigation, and right-rail TOC
generation.

## Pick a template by kind

| Page kind     | Template                | Use for                                                       |
|---------------|-------------------------|---------------------------------------------------------------|
| `reference`   | `reference.md`          | Per-resource API reference (e.g. `/docs/api/vms`)             |
| `concept`     | `concept.md`            | Conceptual explainers (e.g. `/docs/authentication`)           |
| `guide`       | `guide.md`              | Step-by-step tutorials (e.g. `/docs/guides/postgres-production`) |
| `quickstart`  | `quickstart.md`         | Onboarding flows where the goal is "running in 5 minutes"     |
| `sdk`         | `sdk.md`                | Language-specific SDK docs (e.g. `/docs/sdks/typescript`)     |
| `cli`         | `cli.md`                | Command-line tool docs (e.g. `/docs/cli`)                     |

If you're unsure which to pick, check what shape similar pages already
use. `kind` drives small UI affordances (icon, JSON-LD `@type`,
breadcrumb) so picking the wrong one isn't fatal — the page renders
fine — but it makes the docs less internally consistent over time.

## Workflow

1. **Pick the destination URL.** It's the file path. `/docs/api/foo` → `content/api/foo/en.md`.
2. **Copy the template:**

   ```bash
   cp content/_templates/reference.md content/api/foo/en.md
   ```

3. **Open `manifest.json`** and add an entry under the right section.
   See an existing entry in the same section for the field shape.
4. **Edit your new page.** Delete the top-line `<!-- TEMPLATE -->`
   marker — the lint workflow rejects any committed page in
   `content/` (outside `_templates/`) that still has it.
5. **Run `npm run lint`** to catch frontmatter, placeholder, and
   markdownlint issues locally.
6. **Open a PR.** CI runs the same lint checks; if they pass,
   reviewer + merge.

## What every template carries

All templates start with the same scaffold:

- **Frontmatter** with required fields (`title`, `description`,
  `publishedAt`, `updatedAt`, `kind`). The validator schema is at
  `scripts/validate-frontmatter.mjs`; matches the Zod schema in the
  Frontend-index repo.
- **A single `# H1`** — the body title, separate from frontmatter's
  `title` field (the renderer uses the H1 for display; `title` is for
  the sidebar and `<title>` tag).
- **An intro paragraph** (one to three sentences) framing what the
  page is about. The first paragraph is what gets indexed for snippet
  display; treat it like the lead in a news article.
- **H2 sections with stable anchors** in the form
  `## Heading text {#stable-anchor}`. Anchors must be lowercase
  hyphenated; they're what `/docs/<page>#anchor` URLs target.
- **A "What's next" closing section** with cross-links to related
  pages. Cuts down dead-end reading; usually adds 4–8 % to
  on-site depth.
- **`{{NAME}}` placeholders** for canonical hostnames (see
  `CONTRIBUTING.md` for the full list). Don't type
  `https://api.nimbusnexus.net` literally — use `{{API_BASE_URL}}`.

## What's different per kind

Each template captures the differences in body structure for its
kind. Read the template you're copying — the inline `<!-- ... -->`
comments explain what each section is for and how long it should be.

## Don't add a manifest entry for the templates

Templates aren't rendered. Adding a manifest entry would make them
appear in the sidebar and as a public URL. The CI validates that
`content/_templates/*` doesn't appear in `manifest.json`.
