---
title: "Referencia de la API"
description: "Todas las operaciones de todos los productos de NimbusNexus, apps e infraestructura, con la llamada REST y la del SDK en el lenguaje que elijas."
publishedAt: 2026-10-19
updatedAt: 2026-11-06
kind: reference
---

# Referencia de la API

Cada producto de NimbusNexus es una API REST, y aquí están todas sus operaciones. Apps son los productos gestionados a los que llamas desde tu código: Webhooks, Inboxes, códigos QR y Request Bins. Infraestructura son los recursos en la nube de tus proyectos: VMs, almacenamiento, red y DNS.

Cada operación muestra su petición en el lenguaje elegido en la parte superior de la página. REST es `curl`. En TypeScript, Python y Go ves la llamada del SDK cuando el producto tiene SDK, y el cliente HTTP habitual de ese lenguaje cuando no lo tiene. Te autenticas con una clave de API, que se configura en [API REST](/docs/setup/rest): va en la cabecera `Authorization` en las apps y en la cabecera `X-API-Key` en infraestructura. En las apps, los errores comparten un único formato, descrito en [Errores](/docs/errors); en infraestructura, consulta [Convenciones](/docs/conventions#errors).
