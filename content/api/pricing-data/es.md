---
title: "Datos de precios"
description: "Acceso programático a la lista de precios oficial. Solo lectura."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: pricing-data
---

# Datos de precios

Los endpoints de datos de precios son una fuente de solo lectura con lo que cobra NimbusNexus, un endpoint por cada tipo de recurso:

- `GET /api/v1/pricing/vm` — tamaños de VM. `architecture` y `vm_class` son obligatorios; `cpu` y `ram` acotan la lista.
- `GET /api/v1/pricing/storage` — almacenamiento en bloques, para un `volume_type`.
- `GET /api/v1/pricing/port`, `/api/v1/pricing/floating_ip` y `/api/v1/pricing/image` — puertos de red, IPs flotantes y almacenamiento de imágenes.
- `GET /api/v1/pricing/bandwidth` — ancho de banda de salida.

Cada precio indica su periodo de facturación: una sola vez, por hora, por día, por mes o por año. No necesitas iniciar sesión para leerlos. Quien llama con el alcance de uno de tus proyectos ve los precios que se aplican a tu workspace; cualquier otro ve los precios de lista.

Casos de uso: integrar estimaciones de coste en tiempo real en tu flujo de aprovisionamiento (mostrar "esta VM costará $X/mes" antes de que el usuario haga clic en Launch), crear herramientas internas de imputación de costes o simplemente mantener tu propia hoja de cálculo de "cuánto cobra ahora mismo NimbusNexus por X".

Los precios se expresan en USD.

## Próximos pasos {#next-steps}

- [Facturación](/docs/api/invoices) — tus saldos y los cargos que aún no se han liquidado.
- [Optimiza tu factura mensual](/docs/guides/cost-optimization) — la guía de estrategia para reducir tu factura.
- La [página de precios de la web comercial]({{BASE_URL}}/pricing) — la versión legible por personas de estos datos.
