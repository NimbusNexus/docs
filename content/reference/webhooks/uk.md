---
title: "API Webhooks"
description: "Усі операції REST API Webhooks із викликом REST, викликом SDK на Python, TypeScript або Go і командою nn-webhooks."
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: reference
---

# API Webhooks

REST API, на якому працює [Webhooks](/docs/product-webhooks): публікуйте події, керуйте ендпоінтами, що їх отримують, переглядайте, повторно доставляйте й переграйте доставки. Кожна операція нижче показує свій запит мовою, вибраною вгорі сторінки. Якщо операція є в [SDK](/docs/product-webhooks/sdks) або [CLI](/docs/product-webhooks/cli), ви бачите цей виклик; інакше — звичайний HTTP-запит.

Для викликів потрібен API-ключ для Webhooks, створений у [консолі акаунта]({{ACCOUNT_BASE_URL}}/api-keys). Його область дії визначає, що він може робити: `admin` може все, `publish` — лише публікувати, `read` — лише читати. Операції запису, які приймають проєкт, застосовуються до проєкту робочого простору за замовчуванням, якщо ви не передасте `project_id`.
