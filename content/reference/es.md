---
title: "Referencia de la API"
description: "Todas las operaciones de todos los productos de NimbusNexus, apps e infraestructura, con la llamada REST y la del SDK en el lenguaje que elijas."
publishedAt: 2026-10-19
updatedAt: 2026-10-22
kind: reference
---

# Referencia de la API

Cada producto de NimbusNexus es una API REST, y aquí están todas sus operaciones. Apps son los productos gestionados a los que llamas desde tu código: Webhooks, Inboxes, códigos QR y Request Bins. Infraestructura son los recursos en la nube de tus proyectos: VMs, almacenamiento, bases de datos, red y DNS.

Cada operación muestra su petición en el lenguaje elegido en la parte superior de la página. REST es `curl`. En TypeScript, Python y Go ves la llamada del SDK cuando el producto tiene SDK, y el cliente HTTP habitual de ese lenguaje cuando no lo tiene. La autenticación es igual en todas partes: una clave de API en la cabecera `Authorization`, que se configura en [API REST](/docs/setup/rest). Los errores comparten un único formato, descrito en [Errores](/docs/errors).
