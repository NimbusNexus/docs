---
title: Webhooks API
description: Every operation of the Webhooks REST API, with the REST call, the SDK call in Python, TypeScript or Go, and the nn-webhooks command.
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: reference
---

# Webhooks API

The REST API behind [Webhooks](/docs/product-webhooks): publish events, manage the endpoints that receive them, and inspect, redeliver and replay deliveries. Every operation below shows its request in the language picked at the top of the page. Where the [SDK](/docs/product-webhooks/sdks) or the [CLI](/docs/product-webhooks/cli) has the operation, you see that call; otherwise you see a plain HTTP request.

Calls take an API key for Webhooks, created in your [account console]({{ACCOUNT_BASE_URL}}/api-keys). Its scope decides what it can do: `admin` can do everything, `publish` can only publish, and `read` can only read. Writes that take a project apply to the workspace's default project unless you pass `project_id`.
