---
title: "API de Newsletters"
description: "Todas las operaciones de la API REST de Newsletters, con la petición en curl, TypeScript, Python o Go."
publishedAt: 2026-10-19
updatedAt: 2026-10-19
kind: reference
---

# API de Newsletters

La API REST que hay detrás de Newsletters: gestionar listas y sus temas, publicar formularios de suscripción con doble opt-in, gestionar suscriptores y su consentimiento, y redactar, probar y enviar ediciones. Cada operación de abajo muestra su petición en el lenguaje elegido en la parte superior de la página. Newsletters todavía no tiene SDK, así que TypeScript, Python y Go usan el cliente HTTP habitual de cada lenguaje.

Las llamadas requieren una clave de API de Newsletters, creada en la [consola de tu cuenta]({{ACCOUNT_BASE_URL}}/api-keys). Las rutas públicas para suscriptores no requieren clave: son las que llaman un formulario de suscripción y los enlaces del correo enviado.
