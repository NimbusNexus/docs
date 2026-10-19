---
title: Newsletters API
description: Every operation of the Newsletters REST API, with the request in curl, TypeScript, Python or Go.
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: reference
---

# Newsletters API

The REST API behind Newsletters: manage lists and their topics, publish double opt-in sign-up forms, manage subscribers and their consent, and write, test and send issues. Every operation below shows its request in the language picked at the top of the page. Newsletters has no SDK yet, so TypeScript, Python and Go use each language's usual HTTP client.

Calls take an API key for Newsletters, created in your [account console]({{ACCOUNT_BASE_URL}}/api-keys). The public subscriber routes take no key: they are what a sign-up form and the links in sent mail call.
