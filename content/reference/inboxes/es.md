---
title: "API de Inboxes"
description: "Todas las operaciones de la API REST de Inboxes, con la petición en curl, TypeScript, Python o Go."
publishedAt: 2026-10-19
updatedAt: 2026-10-27
kind: reference
---

# API de Inboxes

La API REST que hay detrás de [Inboxes](/docs/product-inboxes): crear inboxes, las direcciones de email desechables, y encontrarlos por su dirección; renombrarlos, desactivarlos y borrarlos; leer y buscar el correo que reciben, en un inbox o en todos a la vez, y vaciarlos; y consultar tu plan y tu consumo. Cada operación de abajo muestra su petición en el lenguaje elegido en la parte superior de la página. Inboxes todavía no tiene SDK, así que TypeScript, Python y Go usan el cliente HTTP habitual de cada lenguaje.

Las llamadas requieren una clave de API de Inboxes, creada en la [consola de tu cuenta]({{ACCOUNT_BASE_URL}}/api-keys). Para leer mensajes por la API hace falta un plan de pago; el [inicio rápido](/docs/product-inboxes/quickstart) te guía por un primer inbox, y el [resumen](/docs/product-inboxes#search) explica cómo buscar mensajes y leer sus cabeceras.
