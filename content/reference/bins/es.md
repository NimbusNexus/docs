---
title: "API de Request Bins"
description: "Todas las operaciones de la API REST de Request Bins, con la petición en curl, TypeScript, Python o Go."
publishedAt: 2026-10-22
updatedAt: 2026-10-30
kind: reference
---

# API de Request Bins

La API REST que hay detrás de [Request Bins](/docs/product-bins): crear bins y encontrarlos por su URL; renombrarlos, desactivarlos y eliminarlos; reenviar lo que registran a tu propio servidor, y probarlo; leer y buscar las peticiones que han registrado, en un bin o en todos a la vez, agrupar por ruta las peticiones de un bin, y vaciarlos; y consultar tu plan y tu consumo, con lo que ha comprado el crédito. Cada operación de abajo muestra su petición en el lenguaje elegido en la parte superior de la página. Request Bins todavía no tiene SDK, así que TypeScript, Python y Go usan el cliente HTTP habitual de cada lenguaje.

Las llamadas requieren una clave de API de Request Bins, creada en la [consola de tu cuenta]({{ACCOUNT_BASE_URL}}/api-keys?product=bins). Para leer las peticiones capturadas con una clave hace falta un plan de pago; el [inicio rápido](/docs/product-bins/quickstart) te guía por un primer bin, y la [referencia](/docs/product-bins/reference) explica qué responde la URL de un bin, los roles y los límites de cada plan.
