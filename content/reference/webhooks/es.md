---
title: "API de Webhooks"
description: "Todas las operaciones de la API REST de Webhooks, con la llamada REST, la del SDK en Python, TypeScript o Go y el comando nn-webhooks."
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: reference
---

# API de Webhooks

La API REST que hay detrás de [Webhooks](/docs/product-webhooks): publicar eventos, gestionar los endpoints que los reciben e inspeccionar, volver a entregar y reenviar entregas. Cada operación de abajo muestra su petición en el lenguaje elegido en la parte superior de la página. Cuando el [SDK](/docs/product-webhooks/sdks) o la [CLI](/docs/product-webhooks/cli) tienen la operación, ves esa llamada; si no, ves una petición HTTP simple.

Las llamadas requieren una clave de API de Webhooks, creada en la [consola de tu cuenta]({{ACCOUNT_BASE_URL}}/api-keys). Su alcance decide lo que puede hacer: `admin` puede hacerlo todo, `publish` solo puede publicar y `read` solo puede leer. Las escrituras que admiten un proyecto se aplican al proyecto por defecto del workspace, salvo que pases `project_id`.
