---
title: Transforms API
description: Every operation of the Transforms REST API, with the request in curl, TypeScript, Python or Go.
publishedAt: 2026-11-06
updatedAt: 2026-11-06
kind: reference
---

# Transforms API

The REST API behind [Transforms](/docs/product-transforms): create pipelines and read them; save and list their versions; test a document, run a saved pipeline on a request, and list the templates to start from; manage credential slots; and check your plan and usage. Every operation below shows its request in the language picked at the top of the page. Transforms has no SDK yet, so TypeScript, Python and Go use each language's usual HTTP client.

Calls take an API key for Transforms, created in your [account console]({{ACCOUNT_BASE_URL}}/api-keys?product=transforms). The [quickstart](/docs/product-transforms/quickstart) walks through a first pipeline, and the [reference](/docs/product-transforms/reference) covers the objects, roles, each plan's limits and the errors.
