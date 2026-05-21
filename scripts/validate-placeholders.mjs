#!/usr/bin/env node
/**
 * Every `{{NAME}}` in docs markdown must reference a placeholder
 * the frontend knows how to interpolate. Catching unknown
 * placeholders at PR time prevents `{{TPYO}}` literals from
 * shipping to the rendered docs.
 *
 * Keep this list in sync with `docsPlaceholders.ts` in the
 * Frontend-index repo. If you add a placeholder there, add it
 * here too.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Recursive markdown-file walker. Same sync-IO approach as
 * `validate-frontmatter.mjs` — no extra dep, works on Node 18+.
 */
function findMdFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) findMdFiles(p, out)
    else if (entry.name.endsWith('.md')) out.push(p)
  }
  return out
}

const KNOWN = new Set([
  'ROOT_DOMAIN',
  'BASE_URL',
  'API_BASE_URL',
  'API_HOST',
  'AUTH_BASE_URL',
  'AUTH_HOST',
  'STATUS_URL',
  'STATUS_HOST',
  'DNS_NS1',
  'DNS_NS2',
  'DNS_NS3',
  'DNS_NS4',
  'S3_ENDPOINT_US_EAST_1',
  'S3_HOST_US_EAST_1',
  'DB_HOST_DEMO',
])

const PLACEHOLDER = /\{\{([A-Z][A-Z0-9_]*)\}\}/g

let errorCount = 0

for (const file of findMdFiles('content')) {
  // Skip the templates directory. Templates aren't rendered, and
  // they sometimes need to discuss the placeholder syntax meta-
  // textually (e.g. "use `{{NAME}}` as a placeholder reference" in
  // the README). Real content under content/ still gets validated
  // normally; the templates themselves use only valid placeholders.
  const relative = file.replaceAll(path.sep, '/')
  if (relative.startsWith('content/_templates/')) continue

  const raw = readFileSync(file, 'utf8')
  const unknownInThisFile = new Set()

  for (const match of raw.matchAll(PLACEHOLDER)) {
    const name = match[1]
    if (!KNOWN.has(name)) unknownInThisFile.add(name)
  }

  if (unknownInThisFile.size > 0) {
    errorCount++
    console.error(`\n✗ ${file}`)
    for (const name of unknownInThisFile) {
      console.error(`    unknown placeholder: {{${name}}}`)
    }
  }
}

if (errorCount > 0) {
  console.error(`\n${errorCount} file(s) reference unknown placeholders.`)
  console.error('Add them to docsPlaceholders.ts in the Frontend-index repo')
  console.error('and to the KNOWN set in this script.')
  process.exit(1)
}

console.log('✓ All placeholders known.')
