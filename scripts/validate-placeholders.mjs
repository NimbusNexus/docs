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
import { readFileSync } from 'node:fs'
import { glob } from 'node:fs/promises'

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

for await (const file of glob('content/**/*.md')) {
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
