#!/usr/bin/env node
/**
 * Validate every content/**\/*.md file's frontmatter against the docs
 * schema. Mirrors the Zod schema in the Frontend-index repo so we
 * catch shape mismatches at PR time, not at deploy time.
 *
 * Exit 0 on success, 1 on any frontmatter error.
 */
import { readFileSync } from 'node:fs'
import { glob } from 'node:fs/promises'
import matter from 'gray-matter'
import { z } from 'zod'

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

for await (const file of glob('content/**/*.md')) {
  const raw = readFileSync(file, 'utf8')
  const parsed = matter(raw)
  const result = frontmatterSchema.safeParse(parsed.data)

  if (!result.success) {
    errorCount++
    console.error(`\n✗ ${file}`)
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || '(root)'
      console.error(`    ${path}: ${issue.message}`)
    }
  }
}

if (errorCount > 0) {
  console.error(`\n${errorCount} file(s) failed frontmatter validation.`)
  process.exit(1)
}

console.log('✓ All frontmatter valid.')
