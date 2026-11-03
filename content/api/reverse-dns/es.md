---
title: "DNS inverso (registros PTR)"
description: "Registros PTR para IPs flotantes — el nombre de host que devuelve la resolución inversa de tu IP."
publishedAt: 2026-05-21
updatedAt: 2026-11-03
kind: reference
openapiTag: reverse-dns
---

# DNS inverso (registros PTR)

El DNS inverso es el nombre de host que obtiene alguien cuando pregunta "¿qué nombre hay detrás de esta IP?" — lo contrario de la resolución DNS normal. Los registros viven en un árbol aparte (`in-addr.arpa.` para IPv4, `ip6.arpa.` para IPv6) y son autoritativos para el bloque de IPs que cubren.

Para la mayoría de las VMs, el DNS inverso por defecto está bien. Configura un PTR personalizado cuando:

- **Gestionas un servidor de correo.** La mayoría de los grandes proveedores de email rechazan el correo de IPs cuyo PTR no coincide con el DNS directo del nombre de host que envía. Sin un PTR que coincida, tu tasa de entrega cae a cero.
- **Un socio te tiene en su lista de permitidos y te identifica por PTR.** Algunos firewalls hacen una verificación de búsqueda inversa y luego directa para el TCP entrante.

Hay dos formas de configurar uno:

- **En una [IP flotante](/docs/api/floating-ips).** `PUT /api/v1/ptr/records/set/{floatingip_id}` configura o sustituye su PTR, con el nombre de host de destino en `ptrdname`; `PUT /api/v1/ptr/records/unset/{floatingip_id}` lo quita. El ID tiene la forma `<region>:<floating-ip-id>`.
- **En una zona inversa que pertenece a tu proyecto.** `POST /api/v1/zones/{zone_id}/ptr/` añade un conjunto de registros PTR para una `ip`, con el nombre de host de destino en `records`.

## Próximos pasos {#next-steps}

- [IPs flotantes](/docs/api/floating-ips) — las IPs reservadas en las que se configuran los PTRs.
- [Zonas DNS](/docs/api/dns-zones) y [Registros DNS](/docs/api/dns-records) — el lado del DNS directo.
