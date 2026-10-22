---
title: API reference
description: Every operation of every NimbusNexus product, apps and infrastructure, with the REST call and the SDK call in the language you pick.
publishedAt: 2026-10-19
updatedAt: 2026-10-22
kind: reference
---

# API reference

Every NimbusNexus product is a REST API, and every operation is listed here. Apps are the managed products you call from your code: Webhooks, Inboxes, QR Codes and Request Bins. Infrastructure is the cloud resources in your projects: VMs, storage, databases, networking and DNS.

Each operation shows its request in the language picked at the top of the page. REST is `curl`. In TypeScript, Python and Go you get the SDK call where the product has an SDK, and that language's usual HTTP client where it does not. Authentication is the same everywhere: an API key in the `Authorization` header, set up in [REST API](/docs/setup/rest). Errors share one shape, described in [Errors](/docs/errors).
