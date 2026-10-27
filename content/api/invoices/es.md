---
title: "Facturas"
description: "Facturas mensuales — listado, consulta y desglose."
publishedAt: 2026-05-21
updatedAt: 2026-05-21
kind: reference
openapiTag: invoices
---

# Facturas

Las facturas se generan cada mes, el día 1 del mes siguiente, e incluyen todo el consumo del mes natural anterior. Cada factura está desglosada por recurso y por día, así que puedes rastrear cualquier línea hasta las VMs / volúmenes / buckets / bases de datos concretos.

Este endpoint da acceso programático a los mismos datos que muestra el panel. Casos de uso: alimentar tu propio sistema de imputación de costes con las líneas de las facturas, archivar las facturas a efectos fiscales, conciliarlas con tu libro de órdenes de compra.

Las facturas también están disponibles en PDF — el mismo formato que se usa para declarar deducciones fiscales en la mayoría de jurisdicciones. El formato JSON es la fuente oficial; el PDF se genera a partir del JSON.

## Próximos pasos {#next-steps}

- [Métodos de pago](/docs/api/payment-methods) — con qué se cobran las facturas.
- [Datos de precios](/docs/api/pricing-data) — los precios por recurso de los que salen los totales de las facturas.
