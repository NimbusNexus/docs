#!/usr/bin/env node
/**
 * Reject committed pages that still carry leftover template markers.
 *
 * Templates in `content/_templates/` open with an HTML comment like
 * `<!-- TEMPLATE — copy this file before editing. Delete this comment
 * when you do. -->`. When an author copies a template to start a new
 * page, they're supposed to delete that block before committing. If
 * they forget, the comment ships to the rendered HTML — invisible to
 * readers, but a clear signal of "this page hasn't been finished."
 *
 * This script catches that at PR time. Any `.md` file under `content/`
 * that's not inside `_templates/` and still contains the literal
 * string `TEMPLATE — copy this file` fails the check.
 *
 * Also: pages under `content/_templates/` are templates by definition
 * and aren't expected to appear in `manifest.json`. We also verify
 * that the manifest doesn't accidentally reference a template path.
 */
import { readFileSync } from 'node:fs'
import { glob } from 'node:fs/promises'

const TEMPLATE_MARKER = 'TEMPLATE — copy this file'

let errorCount = 0

// ── 1. No leftover template markers in regular content
for await (const file of glob('content/**/*.md')) {
  if (file.startsWith('content/_templates/')) continue

  const raw = readFileSync(file, 'utf8')
  if (raw.includes(TEMPLATE_MARKER)) {
    errorCount++
    console.error(`\n✗ ${file}`)
    console.error('    Contains a leftover template marker.')
    console.error(
      '    Delete the `<!-- TEMPLATE — copy this file ... -->` block before committing.'
    )
  }
}

// ── 2. Templates don't appear in the manifest
const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'))
for (const section of manifest.sections ?? []) {
  for (const item of section.items ?? []) {
    if (typeof item.path === 'string' && item.path.startsWith('_templates/')) {
      errorCount++
      console.error(`\n✗ manifest.json`)
      console.error(`    Template path "${item.path}" should not be in the manifest.`)
      console.error('    Templates are not rendered.')
    }
  }
}

if (errorCount > 0) {
  console.error(`\n${errorCount} issue(s) found.`)
  process.exit(1)
}

console.log('✓ No leftover template markers; manifest references no templates.')
