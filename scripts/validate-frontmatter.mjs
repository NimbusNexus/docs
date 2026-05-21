#!/usr/bin/env node
/**
 * Validate every content/**\/*.md file's frontmatter against the docs
 * schema. Mirrors the Zod schema in the Frontend-index repo so we
 * catch shape mismatches at PR time, not at deploy time.
 *
 * Exit 0 on success, 1 on any frontmatter error.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { z } from 'zod'

/**
 * Recursive markdown-file walker. Uses synchronous fs APIs so this
 * script stays single-dep (no `glob` package) and avoids the
 * Node-22-only `node:fs/promises#glob`. The content tree is tiny
 * (tens of files), so sync IO has no measurable cost.
 */
function findMdFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) findMdFiles(p, out)
    else if (entry.name.endsWith('.md')) out.push(p)
  }
  return out
}

const kindEnum = z.enum(['concept', 'reference', 'quickstart', 'guide', 'sdk', 'cli'])

// `publishedAt` and `updatedAt` come out of `gray-matter` as JS Date
// objects when YAML parses them. We accept either a Date or a string
// in YYYY-MM-DD form to keep authors from having to quote dates.
const dateLike = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
)

const frontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  publishedAt: dateLike,
  updatedAt: dateLike,
  kind: kindEnum,
  openApiTag: z.string().optional(),
  toc: z
    .array(z.object({ id: z.string(), label: z.string() }))
    .optional(),
})

let errorCount = 0

for (const file of findMdFiles('content')) {
  const raw = readFileSync(file, 'utf8')
  const parsed = matter(raw)
  const result = frontmatterSchema.safeParse(parsed.data)

  if (!result.success) {
    errorCount++
    console.error(`\n✗ ${file}`)
    for (const issue of result.error.issues) {
      const issuePath = issue.path.join('.') || '(root)'
      console.error(`    ${issuePath}: ${issue.message}`)
    }
  }
}

if (errorCount > 0) {
  console.error(`\n${errorCount} file(s) failed frontmatter validation.`)
  process.exit(1)
}

console.log('✓ All frontmatter valid.')
