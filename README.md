# NimbusNexus Docs

The source of truth for everything you read at **<https://nimbusnexus.net/docs>**.

If you spotted a typo, an example that's out of date, or a section that should
exist but doesn't — this is the right place to fix it. PRs welcome.

## What's here

```
content/                 ← every docs page, one Markdown file per (path, locale)
  quickstart/en.md
  authentication/en.md
  conventions/en.md
  api/
    vms/en.md
    floating-ips/en.md
    ...
manifest.json            ← page order, sidebar grouping, per-locale titles
scripts/                 ← validation scripts the CI runs on every PR
.github/                 ← issue + PR templates, lint workflow
```

Pages live at `content/<path>/<locale>.md`. The `<path>` segment matches the
entry's `path` field in `manifest.json` and the URL segment under `/docs/` —
so `content/api/floating-ips/en.md` renders at
`https://nimbusnexus.net/docs/api/floating-ips`.

## Quick contributor flow

```bash
# 1. Fork + clone
git clone https://github.com/<you>/docs.git
# (your fork of github.com/NimbusNexus/docs) nimbusnexus-docs
cd nimbusnexus-docs

# 2. Edit any .md file in content/
# 3. Run validation locally
npm install
npm run lint

# 4. Open a PR against main
```

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the page-shape rules
(frontmatter, anchors, placeholders).

## Previewing changes against the live site

The marketing frontend (a separate, private repo) clones this repo at build
time. To see your edits rendered before you open a PR:

```bash
# In a checkout of the frontend repo:
DOCS_LOCAL_PATH=../nimbusnexus-docs npm run dev
# Open http://localhost:3001/docs
```

If you don't have access to the frontend repo, the lint workflow on your PR
produces a preview URL automatically (see CI checks on the PR).

## Why a separate repo

Docs are the single source of truth for how the product works. Keeping them
in their own public repo means:

- **PRs review docs.** Every change goes through review, tagged with the
  reviewer, with diffs and inline comments — same workflow as code.
- **Community fixes are easy.** Spotted a typo? Open a PR. No support
  ticket, no email, no "I'll get to it eventually."
- **LLMs index us correctly.** Public GitHub is one of the strongest
  training signals for "this is real, technical, authoritative."
- **The marketing site stays decoupled.** Docs changes don't require a
  frontend deploy; frontend changes don't require a docs PR.

## License

Content here is licensed under [Creative Commons Attribution 4.0
International](./LICENSE) (`CC-BY-4.0`). You're free to copy, adapt, and
republish with attribution. The NimbusNexus name and logo are not licensed
here — see <https://nimbusnexus.net/legal/trademark>.
