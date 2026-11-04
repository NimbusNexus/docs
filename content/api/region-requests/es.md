---
title: "Solicitudes de región"
description: "Pide a NimbusNexus que abra una región que todavía no ofrece."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: region-requests
---

# Solicitudes de región

Una sesión iniciada puede usar cualquier región que ofrezca NimbusNexus: `GET /api/v1/account/datacenters` las lista, y `GET /api/v1/account/rescope?region=<region_name>` cambia a una de ellas (consulta [Resumen de la cuenta](/docs/api/account-overview)). Una solicitud de región es para un lugar donde NimbusNexus todavía no da servicio. Nos dice dónde te gustaría que abriéramos a continuación.

Una solicitud de región no cambia las cuotas. Para aumentar un límite, envía una solicitud de cuota con `POST /api/v1/quota-request/` (consulta [Cuotas](/docs/api/quotas)).

`POST /api/v1/account/region-requests` es la base del formulario "solicitar una región" de la web de NimbusNexus, así que no necesita iniciar sesión. Envía un `email` y un `regionCode`: uno de `ams`, `par`, `mad`, `sto`, `mil`, `waw`, `dxb`, `tlv`, `bom`, `icn`, `hkg`, `cgk`, `gru`, `mex`, `yyz` o `jnb`, o `__other` con el lugar en `regionOtherText`. `company` y `note` son opcionales. La respuesta es solo `success`: no se aprueba ni se concede nada. Contamos las solicitudes para ver dónde hay demanda.

## Próximos pasos {#next-steps}

- [Regiones](/docs/api/regions) — la lista de regiones disponibles.
- [Cuotas](/docs/api/quotas) — cómo pedir un límite más alto.
- [Resumen de la cuenta](/docs/api/account-overview) — el contexto de cuenta del acceso a regiones.
