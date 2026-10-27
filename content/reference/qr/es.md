---
title: "API de códigos QR"
description: "Todas las operaciones de la API REST de códigos QR, con la petición en curl, TypeScript, Python o Go."
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: reference
---

# API de códigos QR

La API REST que hay detrás de [códigos QR](/products/qr-tracked): crear códigos rastreables y cambiar adónde apuntan después de imprimirlos, enrutar los escaneos según reglas, leer las analíticas de escaneo, servir códigos desde tu propio dominio, importar códigos en bloque y recibir un webhook en cada escaneo. Cada operación de abajo muestra su petición en el lenguaje elegido en la parte superior de la página. Todavía no hay SDK para códigos QR, así que TypeScript, Python y Go usan el cliente HTTP habitual de cada lenguaje.

Las llamadas requieren una clave de API de códigos QR, creada en la [consola de tu cuenta]({{ACCOUNT_BASE_URL}}/api-keys).
