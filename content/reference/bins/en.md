---
title: Request Bins API
description: Every operation of the Request Bins REST API, with the request in curl, TypeScript, Python or Go.
publishedAt: 2026-10-22
updatedAt: 2026-10-27
kind: reference
---

# Request Bins API

The REST API behind [Request Bins](/docs/product-bins): create bins and find them by URL; rename, disable and delete them; read and search the requests they recorded, in one bin or across all of them, and empty them; and check your plan and usage. Every operation below shows its request in the language picked at the top of the page. Request Bins has no SDK yet, so TypeScript, Python and Go use each language's usual HTTP client.

Calls take an API key for Request Bins, created in your [account console]({{ACCOUNT_BASE_URL}}/api-keys?product=bins). Reading captured requests with a key needs a paid plan; the [quickstart](/docs/product-bins/quickstart) walks through a first bin, and the [reference](/docs/product-bins/reference) covers what a bin URL answers, roles and each plan's limits.
